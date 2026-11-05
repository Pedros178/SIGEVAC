# Seguridad y privacidad (Fase 13)

## Qué se implementó

| Medida | Dónde |
|---|---|
| Datos de salud (sangre, alergias, discapacidad, enfermedad crónica) **cifrados en la BD** (AES-256-GCM, llave `DATA_ENC_KEY`) | `utils/cifradoDatos.js`, `models/voluntarioModel.js`, migración 022 |
| **Respaldos cifrados** (`.sql.enc`); el volcado en claro solo existe en un directorio temporal privado y se borra siempre | `utils/cifradoArchivos.js`, `controllers/respaldoController.js` |
| La **auditoría ya no guarda** salud, CURP, domicilio, teléfonos ni contacto de emergencia (antes quedaban en claro ahí, anulando el cifrado) | `middlewares/trazabilidad.js` |
| Derechos **ARCO**: exportar datos, anonimizar (cancelación), registro de solicitudes con fecha límite, consentimientos revocables | `/api/privacidad/*`, migración 023, permiso `privacidad.gestionar` |
| El formulario público exige **aceptar el aviso de privacidad** y guarda versión y fecha | `solicitudController`, página `/aviso-privacidad` |
| Enlaces del portal dejan de funcionar si el voluntario fue anonimizado | `middlewares/portalAuth.js` |
| Minimización: se purgan sesiones y tokens caducados (IP, user-agent) | `utils/retencionBitacora.js` |
| Listado de bajas antiguas con datos aún guardados (la asociación decide) | `GET /api/privacidad/retencion/candidatos` |
| Límite de peticiones general y más estricto en endpoints públicos; `urlencoded` simple | `middlewares/limitadores.js`, `app.js` |
| Producción exige `DATA_ENC_KEY` y `TWO_FACTOR_ENC_KEY` propias | `utils/validarEntorno.js` |
| tesseract.js ya no viene de un CDN con versión flotante (`@5`): copia local con versión exacta | `frontend/public/vendor/` |

## Pasos para desplegar (en este orden)

1. **Genera y guarda** las llaves (gestor de contraseñas; sin ellas los datos cifrados NO se recuperan):
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (dos veces, valores distintos).
   Si ya había usuarios con 2FA y no tenías `TWO_FACTOR_ENC_KEY`, sus secretos se cifraron con una llave derivada de
   `JWT_SECRET`: NO hace falta que reactiven nada, el paso 6 los migra a la llave nueva.
2. Configura `DATA_ENC_KEY` y `TWO_FACTOR_ENC_KEY` en Render → Environment.
3. **Respaldo previo** de la base.
4. `npm run db:setup` (aplica migraciones 022 y 023).
5. `npm run db:encrypt-existing` (cifra lo ya guardado; idempotente; `-- --simular` solo cuenta).
6. `npm run db:scrub-audit` (oculta datos sensibles del historial de auditoría; idempotente).
7. `npm run db:migrate-2fa-key` (re-cifra los secretos 2FA existentes con `TWO_FACTOR_ENC_KEY`; necesita `JWT_SECRET` actual; `-- --simular` solo cuenta; todo o nada). **Ejecútalo antes de que la app corra con la llave nueva** o, si ya corre, de inmediato: mientras tanto, los usuarios con 2FA no podrán entrar con código.
8. Los respaldos **antiguos** `.sql` siguen en claro: bórralos del bucket/disco o conviértelos generando uno nuevo.
9. Restaurar un respaldo cifrado: `npm run db:restore -- archivo.sql.enc <URL_DESTINO>` (necesita la misma `DATA_ENC_KEY`).

## Límites y cosas que NO resuelve el código

- **Perder `DATA_ENC_KEY` = perder esos datos y los respaldos.** Rotarla requiere descifrar y re-cifrar antes (no hay herramienta de rotación aún).
- Los campos cifrados no se pueden buscar ni filtrar por SQL (es intencional).
- CURP, teléfono, correo, dirección y datos del tutor **siguen en claro** en la BD (se necesitan para buscar/duplicados). Se protegen con control de acceso, no con cifrado.
- La anonimización no alcanza fotos de grupo en evidencias de actividades ni mensajes ya enviados por correo/WhatsApp.
- La auditoría y bitácora conservan quién hizo qué (sin datos sensibles); es intencional.
- El texto del **aviso de privacidad es una plantilla**: debe revisarlo la representación legal de la asociación (domicilio, finalidades, transferencias) y configurar `VITE_ARCO_CORREO`, `VITE_ARCO_DOMICILIO` y `AVISO_PRIVACIDAD_VERSION`.
- Las fotos de `frontend/public/galeria/` son públicas: confirma autorización de las personas (sobre todo menores).
- OpenCV (`docs.opencv.org/4.9.0`) sigue cargándose desde un sitio externo sin verificación de integridad; lo ideal es alojarlo localmente.
- **Cabeceras del frontend**: Render no lee `_headers`; configúralas en Render → Static Site → Headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000`. Una CSP debe probarse primero con `Content-Security-Policy-Report-Only` (el escáner usa OpenCV/tesseract y WASM).
- No hay todavía pantalla en el panel para ARCO/consentimientos: se usa la API (Swagger en desarrollo).
