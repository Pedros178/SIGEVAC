# Checklist de salida a producción — SIGEVAC

Marca cada punto **solo cuando lo hayas visto funcionar** en tu entorno. Las secciones A–C se pueden hacer
en un entorno de pruebas (*staging*) antes de tocar producción. Todo lo marcado 🔒 es obligatorio.

## A. Configuración (antes de desplegar)

- [ ] 🔒 `NODE_ENV=production` en el backend.
- [ ] 🔒 `JWT_SECRET` y `JWT_REFRESH_SECRET`: aleatorios, **distintos entre sí**, ≥32 caracteres
      (`openssl rand -hex 48`). El servidor se niega a arrancar si parecen valores de ejemplo.
- [ ] 🔒 `DATABASE_URL` con un usuario/contraseña propios (no `postgres`/`admin123`). `DB_SSL=true` si tu proveedor lo exige.
- [ ] 🔒 `FRONTEND_URL` = la URL **exacta** del frontend, con `https://` y sin `/` final (define CORS y los enlaces de los correos).
- [ ] 🔒 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (sin ellos los archivos se pierden al reiniciar).
- [ ] `TWO_FACTOR_ENC_KEY` fijada (aleatoria). Si cambias `JWT_SECRET` más adelante, los 2FA ya configurados seguirán funcionando.
- [ ] SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) — sin esto no llegan los correos de recuperación ni los accesos al portal.
- [ ] `SEED_ADMIN_PASSWORD` **vacío** (se genera una aleatoria) y `SEED_ADMIN_EMAIL` con un correo real que puedas leer.
- [ ] Frontend: `VITE_API_URL` apunta a la API con `https://` (se fija al compilar).
- [ ] Si el frontend y la API están en **dominios distintos**: la cookie de sesión debe viajar entre sitios (el backend usa `SameSite=None; Secure` en producción; requiere HTTPS en ambos).

## B. Base de datos y arranque

- [ ] 🔒 `npm run db:setup` termina con ✅ (es seguro repetirlo en cada despliegue).
- [ ] 🔒 `npm run db:seed` una sola vez: **copia la contraseña que imprime**; es la única vez que se muestra.
- [ ] 🔒 No ejecutar nunca `db:seed:demo` en producción (el script se niega, pero evita el intento).
- [ ] `GET https://TU-API/api/health` responde `{"status":"ok","base_de_datos":"ok"}`.
- [ ] 🔒 Inicia sesión con el administrador: el sistema te **obliga** a cambiar la contraseña inicial. Hazlo.
- [ ] 🔒 Configura 2FA para el super_admin (Administración → Seguridad de tu cuenta).

## C. Verificación automática (staging y luego producción)

```bash
# 1) Prueba de humo: HTTPS, cabeceras, CORS, cookies, archivos expuestos, rutas protegidas
cd backend
API_URL=https://TU-API FRONT_URL=https://TU-FRONTEND \
SMOKE_EMAIL=cuenta-sin-2fa@tu-dominio SMOKE_PASSWORD='...' npm run smoke
# Debe terminar con "0 fallos". Revisa cada ⚠️ aviso.

# 2) Pruebas de navegador (crea datos "E2E-..." → SOLO en staging)
cd ../e2e && npm install
FRONT_URL=https://TU-FRONTEND API_URL=https://TU-API/api \
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD='...' npm test
```

- [ ] 🔒 `npm run smoke`: 0 fallos.
- [ ] 🔒 `e2e`: todas las pruebas correctas (la de "contraseña inicial" se omite sin `E2E_DATABASE_URL`; es normal).

## D. Lo que SOLO puedes comprobar tú, con servicios reales

- [ ] 🔒 **Archivos persistentes:** sube una foto de voluntario y un documento; reinicia/redespliega el backend; comprueba que siguen ahí.
- [ ] 🔒 **Respaldo y restauración (ensayo):** genera un respaldo desde Administración → Respaldos y **restáuralo en una base de prueba**
      (ver `OPERACION.md`, sección 3). Un respaldo que nunca se ha restaurado no es un respaldo.
- [ ] 🔒 **Correo:** solicita "¿Olvidaste tu contraseña?" con un usuario real y comprueba que llega el correo y el enlace funciona.
- [ ] **Portal del voluntario:** solicita acceso con un correo de voluntario y abre el enlace.
- [ ] **Galería pública:** las imágenes publicadas se ven en la página de inicio (otro dominio → `Cross-Origin-Resource-Policy`).
- [ ] **WhatsApp / geocodificación** (si los usas): una prueba real de cada uno.
- [ ] **Dispositivos:** abre el sitio en un teléfono real, instala la PWA y prueba el modo sin conexión (registrar, volver a conectar, sincronizar).
- [ ] **Zona horaria:** crea una actividad y verifica la fecha/hora que muestra respecto a la que esperas.

## E. Operación continua

- [ ] Monitoreo externo (UptimeRobot, Better Stack, etc.) sobre `GET /api/health` cada 1–5 min, con aviso por correo/WhatsApp.
- [ ] Respaldos programados (el sistema solo hace respaldos **cuando alguien los pide**; programa uno diario — ver `OPERACION.md`, sección 2).
- [ ] `npm audit --omit=dev` en backend y frontend cada mes.
- [ ] Persona responsable de rotar secretos y de revisar la bitácora (Administración → Auditoría).
- [ ] 🔒 Si el ZIP original de este proyecto se compartió con alguien: **cambiar las contraseñas de todas las cuentas que existían** en sus respaldos.
