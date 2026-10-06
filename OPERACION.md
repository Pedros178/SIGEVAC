# Guía de operación — SIGEVAC

Para quien mantiene el sistema en producción. Asume el despliegue descrito en `DEPLOY.md` (Render + PostgreSQL + Supabase Storage).

## 1. Tareas habituales

| Tarea | Cómo |
|---|---|
| Crear un usuario | Administración → Usuarios (el rol que puedes asignar depende de tus propios permisos; solo un super_admin crea otros super_admin) |
| Cambiar mi contraseña | Administración → Cambiar contraseña (cierra tus otras sesiones) |
| Un usuario olvidó su contraseña | Que use "¿Olvidaste tu contraseña?" (requiere SMTP) |
| Un usuario perdió su dispositivo de 2FA | Un super_admin: `POST /api/usuarios/:id/2fa/reset` (desactiva su 2FA y cierra sus sesiones) |
| Dar de baja a un usuario | Desactívalo: su sesión deja de funcionar **de inmediato** (la API revalida en cada petición) |
| Mover un usuario de asociación | Agrega la nueva y quita la anterior (`/api/usuarios/:id/asociaciones`); pierde el acceso a la anterior al instante |
| Aplicar una actualización | Despliega el código y ejecuta `npm run db:setup` (solo corre las migraciones pendientes, cada una en su transacción) |
| Ver quién hizo qué | Administración → Auditoría y Bitácora (se purgan solas pasados `BITACORA_RETENCION_DIAS`, 365 por defecto) |

## 2. Respaldos

- **A demanda:** Administración → Respaldos (`POST /api/respaldos`). Usa `pg_dump`; se conservan los últimos `RESPALDOS_MAXIMO` (10).
  Con Supabase Storage configurado el archivo se guarda en el bucket (carpeta `respaldos/`); sin él, en `backend/backups/` (efímero en Render).
- **Desde tu computadora (funciona siempre, requiere `pg_dump` instalado con versión ≥ la de tu base):**
  `pg_dump --no-owner --no-privileges -f respaldo-$(date +%F).sql "postgresql://usuario:clave@host:5432/postgres"`
  Guarda el archivo cifrado y fuera de la nube pública. Si falla con *"server version mismatch"*, instala un cliente más reciente.
- **Programado (recomendado):** el sistema NO programa respaldos por sí mismo. Opciones:
  1. Activar los respaldos automáticos de tu proveedor de PostgreSQL (Supabase/Render) — lo más simple y fiable.
  2. Un cron externo (p. ej. GitHub Actions programado) que ejecute `pg_dump "$DATABASE_URL" -F c -f respaldo.dump` y lo suba a almacenamiento privado.
- **Guarda los respaldos fuera del servidor y cifrados.** Contienen datos personales y hashes de contraseñas. No los compartas por correo ni los incluyas en ZIP del proyecto.

## 3. Restaurar un respaldo (ensayado y verificado)

Siempre **a una base vacía y nueva** (nunca directamente sobre producción):

```bash
cd backend
# 1. Crea una base vacía en tu servidor PostgreSQL (ejemplo local)
createdb sigevac_restaurada

# 2. Restaura (una sola transacción: o queda completa o no queda nada)
npm run db:restore -- ruta/al/respaldo.sql postgresql://usuario:clave@host:5432/sigevac_restaurada

# 3. Compara con la base de origen, tabla por tabla (conteo + huella del contenido)
npm run db:verify-restore -- postgresql://.../sigevac postgresql://.../sigevac_restaurada
```

- El script **se niega** a restaurar sobre una base que ya tiene tablas (salvo `--forzar`) y nunca usa `DATABASE_URL` por omisión.
- Si el origen siguió recibiendo escrituras después del respaldo, es normal que la comparación muestre diferencias en
  `bitacora`, `auditoria`, `sesiones` y `respaldos`; el resto debe coincidir.
- Para recuperar producción: restaura a una base nueva, **verifica**, apunta `DATABASE_URL` a la nueva y redespliega.
  Los archivos (fotos/documentos) viven en Supabase Storage, no en el respaldo SQL.
- Si usas `pg_dump -F c` (formato personalizado), restaura con `pg_restore --single-transaction --no-owner -d <url> archivo.dump`.

Ensayo hecho durante la auditoría: respaldo generado por la app → base nueva → 47 tablas / 4 893 filas idénticas;
archivo corrupto → reversión total (0 tablas); la API arrancó sobre la base restaurada y devolvió los mismos datos.

## 4. Secretos: cómo rotarlos

| Secreto | Efecto de cambiarlo | Procedimiento |
|---|---|---|
| `JWT_SECRET` | Todas las sesiones activas dejan de valer (la gente debe volver a entrar). **Los 2FA siguen funcionando si `TWO_FACTOR_ENC_KEY` está fijada** | Cambia la variable y redespliega |
| `JWT_REFRESH_SECRET` | Igual: cierra todas las sesiones | Ídem |
| `TWO_FACTOR_ENC_KEY` | Los secretos 2FA guardados dejan de descifrarse: **todos tendrían que reconfigurar su 2FA** | No la cambies salvo compromiso; si lo haces, un super_admin debe reiniciar el 2FA de cada usuario |
| Contraseña de la BD | La API pierde conexión hasta actualizar `DATABASE_URL` | Cambia en el proveedor y actualiza la variable en el mismo momento |
| `SUPABASE_SERVICE_ROLE_KEY` | Los archivos dejan de leerse/escribirse hasta actualizar | Genera la nueva en Supabase, actualiza la variable |

**Ante una sospecha de robo de sesión:** cierra todas las sesiones con
`UPDATE sesiones SET revocado = true;` (en la BD) y rota `JWT_SECRET`/`JWT_REFRESH_SECRET`.
El sistema ya detecta por sí solo la reutilización de un refresh token robado y cierra las sesiones de esa cuenta.

## 5. Monitoreo y diagnóstico

- `GET /api/health` → `{"status":"ok","base_de_datos":"ok"}`. Si `base_de_datos` ≠ `ok`, la API está arriba pero sin BD.
- Los errores 5xx se escriben en los logs del servidor como `Error no controlado:` (los errores de usuario, 4xx, no).
- Una ráfaga de respuestas `429` en `/api/auth/*` indica intentos masivos de acceso.
- `401` repetidos para una misma cuenta pueden ser un bloqueo temporal (5 intentos fallidos → 15 min). Por seguridad la respuesta es idéntica a la de una contraseña incorrecta; consulta `usuarios.bloqueado_hasta` en la BD para confirmarlo.

## 6. Limitaciones conocidas (decisiones de diseño)

- **Bloqueo de cuenta:** quien conozca un correo puede bloquear esa cuenta 15 min con intentos fallidos. Si ocurre de forma abusiva, considera un CAPTCHA o un WAF delante.
- **Rate limit en memoria:** con más de una instancia del backend, cada una cuenta aparte (el bloqueo de cuenta sí es compartido). Para escalar, usa un almacén compartido (Redis).
- **Búsqueda de voluntarios:** es un escaneo secuencial (30–40 ms con 20 000 registros). Con cientos de miles, añade un índice `pg_trgm`.
- **Reportes:** se generan en memoria sin paginar (1.3 MB con 18 000 filas); con volúmenes mucho mayores conviene exportar por lotes.
- **Firma electrónica:** es una imagen dibujada con IP y navegador; no equivale a una firma electrónica avanzada ligada criptográficamente al documento.
