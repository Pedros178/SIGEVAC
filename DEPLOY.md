# Despliegue de SIGEVAC en producción (100% gratuito, sin tarjeta de crédito)

Esta guía usa **Supabase** para la base de datos PostgreSQL y **Render** para el backend (API) y el frontend (sitio estático). Ambos ofrecen un plan gratuito verificado en 2026 que no pide tarjeta de crédito.

> **Nota importante:** estos pasos requieren crear cuentas y hacer clic en paneles web (Supabase, Render, GitHub). Esta guía te da los valores exactos que debes copiar/pegar en cada campo. Si algo no coincide con lo que ves en pantalla o un paso falla, conserva el mensaje de error para diagnosticarlo.

## Limitaciones honestas del plan gratuito (impórtalas para tu defensa)

| Limitación | Impacto | Mitigación |
|---|---|---|
| Supabase gratis pausa el proyecto tras 7 días sin actividad | La API dejaría de responder hasta reactivarlo manualmente desde el panel de Supabase | Antes de tu defensa, entra al panel de Supabase para "despertar" el proyecto un día antes |
| Render (plan free) apaga el servicio tras 15 min sin tráfico | La primera petición tras estar dormido tarda 30-60 segundos (arranque en frío) | Normal en demos; explica esto si el jurado lo nota, es una limitación conocida del *hosting* gratuito, no un bug |
| El disco de Render (plan free) **no es persistente** entre despliegues | Los archivos subidos a `uploads/` y los respaldos en `backups/` se perderían si el servicio se reinicia o se vuelve a desplegar | Documentado como trabajo futuro: migrar el almacenamiento de archivos a un bucket compatible con S3 (p. ej. Supabase Storage) |

Estas limitaciones son normales en cualquier plan gratuito y **no invalidan el proyecto** — de hecho, identificarlas y documentarlas explícitamente es parte de un buen análisis de ingeniería (ver sección "Trabajo futuro" de la Documentación Técnica).

---

## Paso 1 — Crear la base de datos en Supabase

1. Ve a **supabase.com** y crea una cuenta gratuita (con GitHub es más rápido).
2. Clic en **New Project**.
   - **Name**: `sigevac`
   - **Database Password**: genera una segura y **guárdala** (la necesitas para el connection string).
   - **Region**: la más cercana a México (p. ej. `us-east-1` o `sa-east-1` si está disponible).
3. Espera 1-2 minutos a que aprovisione el proyecto.
4. Ve a **Project Settings → Database → Connection string** y copia el modo **URI**.
   - Se ve así: `postgresql://postgres:[TU-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres`
5. Ve a **Storage → New bucket**, crea un bucket llamado `sigevac-files` y déjalo **privado**. La `SUPABASE_SERVICE_ROLE_KEY` se obtiene en **Project Settings → API** y solo debe configurarse como secreto en Render.

La asociación inicial de SIGEVAC es **Asociación Juvenil "Sueños de Comedia", A.C.**, con municipio **Huamantla** y estado **Tlaxcala**.

## Paso 2 — Aplicar el esquema y los seeds a Supabase (desde tu máquina, una sola vez)

En tu computadora, con el repositorio clonado:

```bash
cd backend
cp .env.example .env
```

Edita `.env` y reemplaza:
```
DATABASE_URL=postgresql://postgres:TU-PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
DB_SSL=true
```

Luego corre:
```bash
npm install
npm run db:setup   # crea el esquema y aplica todas las migraciones
npm run db:seed    # roles, permisos, catálogos, asociación y super_admin
```

Verifica en el panel de Supabase (**Table Editor**) que las tablas aparecieron.

> `npm run db:setup` está pensado para una base vacía. Para una base ya existente, aplica únicamente las migraciones pendientes en orden, sin volver a ejecutar `schema.sql` sobre tablas creadas.

## Paso 3 — Desplegar el backend en Render

1. Ve a **render.com**, crea cuenta gratuita (con GitHub es más rápido).
2. Clic en **New → Web Service**.
3. Conecta el repositorio `Pedros178/SIGEVAC`.
4. Configura:
   - **Name**: `sigevac-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. En **Environment Variables**, agrega:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | El mismo connection string de Supabase del Paso 1 |
| `DB_SSL` | `true` |
| `JWT_SECRET` | Genera una cadena aleatoria larga (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Otra cadena aleatoria distinta a la anterior |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `MAX_INTENTOS_FALLIDOS` | `5` |
| `BLOQUEO_MINUTOS` | `15` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | (lo completas en el Paso 5, después de desplegar el frontend) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase; guárdala solo como secreto en Render |
| `SUPABASE_STORAGE_BUCKET` | `sigevac-files` (créalo como bucket privado) |
| `SEED_ADMIN_EMAIL` | Correo del administrador inicial |
| `SEED_ADMIN_PASSWORD` | Contraseña inicial; usa una cadena segura y entre comillas si contiene `#` |
| `SMTP_HOST` | Servidor SMTP de tu proveedor de correo |
| `SMTP_PORT` | `587` (o `465` si tu proveedor usa SSL) |
| `SMTP_USER` | Cuenta autorizada para enviar correo |
| `SMTP_PASS` | Contraseña o clave de aplicación SMTP |
| `SMTP_FROM` | Remitente verificado, por ejemplo `SIGEVAC <no-reply@tu-dominio.org>` |

6. Clic en **Create Web Service**. Espera el build (2-4 minutos).
7. Cuando termine, Render te da una URL pública como `https://sigevac-api.onrender.com`. Pruébala:
   ```
   https://sigevac-api.onrender.com/api/health
   ```
   Debe responder `{"status":"ok",...}`. La documentación interactiva queda en `https://sigevac-api.onrender.com/api/docs`.

> **Correo obligatorio para operación completa:** sin SMTP configurado, el login de recuperación de contraseña y los enlaces del portal solo se registran en los logs del backend; no llegan a los usuarios.

> **WhatsApp opcional:** configura `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` con credenciales de Meta WhatsApp Cloud API. El número debe recibirse en formato internacional y Meta puede exigir plantillas aprobadas para mensajes iniciados por el negocio.

> **Almacenamiento obligatorio para operación completa:** Render Free no conserva `uploads/` entre despliegues. Para producción real, configura un volumen persistente o migra `backend/uploads/` a almacenamiento de objetos (por ejemplo, Supabase Storage/S3) antes de recibir documentos reales.

> **Respaldos:** el botón de respaldos ejecuta `pg_dump` en el servidor. En Render debes usar una imagen/entorno que incluya las herramientas cliente de PostgreSQL y confirmar en los logs que `pg_dump --version` está disponible; si falta, la API responde `503` con un mensaje explicativo.

## Paso 4 — Desplegar el frontend en Render (sitio estático)

1. Clic en **New → Static Site**.
2. Conecta el mismo repositorio `Pedros178/SIGEVAC`.
3. Configura:
   - **Name**: `sigevac`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. En **Environment Variables**, agrega:

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://sigevac-api.onrender.com/api` (la URL del Paso 3 + `/api`) |

5. Clic en **Create Static Site**. Render te da una URL como `https://sigevac.onrender.com`.

## Paso 5 — Conectar el backend con la URL real del frontend (CORS)

Vuelve al servicio `sigevac-api` en Render → **Environment** → edita `FRONTEND_URL` con la URL real de tu sitio estático del Paso 4 (sin `/` al final). Guarda — Render redepliega automáticamente.

## Paso 6 — Probar todo

1. Abre `https://sigevac.onrender.com` (dale 30-60 segundos si es la primera visita).
2. Inicia sesión con el usuario `super_admin` creado en el Paso 2.
3. Verifica que el Dashboard cargue indicadores reales.
4. Registra un voluntario de prueba escribiendo estado y municipio, carga un documento, genera su ficha PDF y verifica un reporte en JSON, CSV y Excel.
5. Comprueba que un usuario de una asociación no pueda consultar voluntarios, actividades o archivos de otra asociación.

## (Opcional) Mantener el backend "despierto" durante tu defensa

Un día antes de tu defensa, puedes usar un servicio gratuito como **UptimeRobot** (uptimerobot.com) para hacer ping a `/api/health` cada 5 minutos y mantenerlo activo.

---

## Variables de entorno — referencia rápida

Todas están documentadas con comentarios en `backend/.env.example`. Genera secretos aleatorios con:
```bash
openssl rand -hex 32
```

## Pruebas antes de publicar

Desde `backend`:

```bash
npm test
```

Desde `frontend`:

```bash
npm run build
```

Para habilitar respaldos localmente, instala PostgreSQL Client Tools y verifica:

```bash
pg_dump --version
```
