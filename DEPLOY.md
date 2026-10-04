# Despliegue de SIGEVAC en producción (100% gratuito, sin tarjeta de crédito)

Esta guía usa **Supabase** para la base de datos PostgreSQL y **Render** para el backend (API) y el frontend (sitio estático). Ambos ofrecen un plan gratuito verificado en 2026 que no pide tarjeta de crédito.

> **Nota importante:** estos pasos requieren crear cuentas y hacer clic en paneles web (Supabase, Render, GitHub). Esta guía te da los valores exactos que debes copiar/pegar en cada campo. Si algo no coincide con lo que ves en pantalla o un paso falla, conserva el mensaje de error para diagnosticarlo.

## Limitaciones honestas del plan gratuito (impórtalas para tu defensa)

| Limitación | Impacto | Mitigación |
|---|---|---|
| Supabase gratis pausa el proyecto tras 7 días sin actividad | La API dejaría de responder hasta reactivarlo manualmente desde el panel de Supabase | Antes de tu defensa, entra al panel de Supabase para "despertar" el proyecto un día antes |
| Render (plan free) apaga el servicio tras 15 min sin tráfico | La primera petición tras estar dormido tarda 30-60 segundos (arranque en frío) | Normal en demos; explica esto si el jurado lo nota, es una limitación conocida del *hosting* gratuito, no un bug |
| El disco de Render (plan free) **no es persistente** entre despliegues | Sin Supabase Storage configurado, los archivos subidos a `uploads/` (galería, documentos) y los respaldos en `backups/` se perderían en cada reinicio/redeploy | **Ya resuelto, no es solo "trabajo futuro":** el backend usa Supabase Storage cuando `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_STORAGE_BUCKET` están configuradas, y **se niega a arrancar** sin ellas si detecta que corre en Render o con `NODE_ENV=production` (ver "Almacenamiento de archivos" más abajo) |

Estas limitaciones son normales en cualquier plan gratuito y **no invalidan el proyecto** — de hecho, identificarlas y documentarlas explícitamente es parte de un buen análisis de ingeniería (ver sección "Trabajo futuro" de la Documentación Técnica).

## ⚠️ Almacenamiento de archivos (galería, documentos, respaldos) — leer antes de subir fotos reales

**Si las fotos de la galería pública dejaron de verse (o nunca aparecieron) sin que nadie tocara el código, casi siempre es esto:**

1. Alguien subió una foto desde el panel de Administración cuando el backend **todavía no tenía Supabase Storage configurado** (o corría con `NODE_ENV` distinto de `production` en Render, sin que la validación de variables obligatorias se disparara).
2. El archivo se guardó en el disco local del contenedor (`backend/uploads/`), que en Render (plan free) **se borra en cada reinicio, redeploy o hibernación**.
3. El registro de esa foto **sigue existiendo en la base de datos** (Postgres/Supabase sí es persistente) y sigue marcado como publicado.
4. Resultado: `GET /api/publico/galeria` devuelve esa foto con toda normalidad, pero al pedir la imagen real (`GET /api/publico/galeria/:id/imagen`) el backend responde `404` porque el archivo ya no existe — el navegador muestra un ícono de imagen rota.

**Esto ya está mitigado en dos capas, pero conviene entender ambas:**

- **Backend, a prueba de errores:** `app.js` exige `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET` (además de las demás variables obligatorias) no solo cuando `NODE_ENV=production`, sino también cuando detecta la variable `RENDER=true` que Render fija automáticamente en todos sus servicios — así que ya no es posible desplegar en Render "por accidente" sin almacenamiento persistente. Además, `server.js` imprime una advertencia bien visible en los logs en cada arranque si el backend está guardando archivos en disco local, para que sea imposible pasarla por alto revisando los logs del servicio.
- **Frontend, tolerante a fotos individuales rotas:** la página pública (`Home.jsx`) ya no muestra un ícono roto si una foto puntual falla al cargar — la descarta de la vista automáticamente, y si terminan fallando todas, vuelve a la galería de respaldo (las fotos fijas en `frontend/public/galeria/`) en vez de dejar la sección vacía o rota.

**Si ya tienes fotos "fantasma" (publicadas en la base de datos pero sin archivo real) de antes de este arreglo:** entra a Administración → Galería y vuelve a subirlas (o bórralas si ya no aplican) **después** de haber configurado Supabase Storage correctamente — ver Paso 1 y Paso 3 más abajo.

## Estado de seguridad de las dependencias

`npm audit` (verificado en esta revisión, corre en CI en cada push/PR):

- **Backend**: `npm audit` → **0 vulnerabilidades**.
- **Frontend**: `npm audit` → **0 vulnerabilidades**.

Ambos proyectos estuvieron con vulnerabilidades moderadas/altas en `react-router-dom`, `vite`/`esbuild`, `multer`, `nodemailer` y `qs` (anidada dentro de `express`) en versiones anteriores de este documento. Se resolvieron así:

| Paquete | Cambio | Nota |
|---|---|---|
| `react-router-dom` | v6 → **v7.18.3** | Migración sin cambios de código: el proyecto usa la API declarativa estándar (`<BrowserRouter>`, `useNavigate`, `<Link>`), compatible entre versiones. Verificado con build + los 55 tests de frontend en verde. |
| `vite` | v5 → **v6.4.3** | Salto conservador dentro de una serie que ya trae `esbuild` parcheado, en vez del salto a v8 que sugiere `npm audit fix --force` (mayor riesgo de romper `vite-plugin-pwa` sin necesidad). |
| `multer`, `nodemailer` | Parche menor vía `npm audit fix` | Sin cambios de API. |
| `qs` (dependencia interna de `express`, que la fija a `~6.15.1`) | Forzado a `^6.16.0` vía `overrides` en `package.json` | `express` (última versión 4.x) aún no actualizó su propia dependencia; el override es la única forma de parchear sin esperar a esa actualización. |

Puedes reproducir la auditoría tú mismo con `npm audit` dentro de `backend/` y `frontend/`.

---

## Paso 0 — Subir el proyecto a GitHub (si todavía no está ahí)

El repositorio ya viene inicializado con git y un primer commit (`git log` para verlo). Solo falta conectarlo a GitHub:

1. Ve a **github.com/new** y crea un repositorio vacío (sin README, sin `.gitignore` ni licencia — ya los trae este proyecto). Anota la URL, por ejemplo `https://github.com/tu-usuario/SIGEVAC.git`.
2. En tu computadora, dentro de la carpeta del proyecto:
   ```bash
   git remote add origin https://github.com/tu-usuario/SIGEVAC.git
   git branch -M main
   git push -u origin main
   ```
3. Verifica en GitHub que los archivos aparecieron y que **NO** aparece ningún `.env` ni `.env.test` (solo `.env.example` y `.env.test.example`) — el `.gitignore` ya los excluye, pero es buena práctica confirmarlo antes de dar por hecho que el repo es público-seguro.
4. Ve a la pestaña **Actions** del repositorio: el workflow de CI (`.github/workflows/ci.yml`) debe correr solo con el primer push y quedar en verde (lint + `npm audit` + tests + build, backend y frontend).

Con el código ya en GitHub, los Pasos 3 y 4 de esta guía (desplegar en Render) piden conectar ese mismo repositorio.

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

> `npm run db:setup` es idempotente: sobre una base vacía aplica `schema.sql`; sobre una base existente se
> omite `schema.sql` y solo corren las migraciones que no consten en `schema_migrations` (cada una en su
> propia transacción, con un lock para que dos despliegues simultáneos no se pisen). Es seguro ejecutarlo en cada despliegue.
>
> `npm run db:seed` imprime **una sola vez** la contraseña inicial del super_admin si no definiste
> `SEED_ADMIN_PASSWORD`. Guárdala y cámbiala en el primer inicio de sesión.

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

> **WhatsApp (opcional, pero con un requisito que sorprende):** ver la sección "WhatsApp: plantillas obligatorias" más abajo. En resumen: no basta con el token y el número — Meta **rechaza el texto libre** en mensajes que inicia la asociación, así que hace falta una plantilla aprobada (`WHATSAPP_TEMPLATE_NOTIFICACION`) o no se envía nada.

> **Almacenamiento de archivos:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET` (tabla de arriba) no son opcionales — el backend se niega a arrancar sin ellas en Render o con `NODE_ENV=production`, precisamente para evitar el problema de "las fotos de la galería no cargan" descrito en la sección "Almacenamiento de archivos" al inicio de esta guía. Sin ellas, los archivos se guardarían en el disco local del contenedor, que Render Free borra en cada reinicio/redeploy.

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

> **Cookie de sesión entre subdominios:** con `NODE_ENV=production` (ya configurado en el Paso 3), el backend emite la cookie del refresh token con `SameSite=None; Secure`, necesario porque `sigevac.onrender.com` y `sigevac-api.onrender.com` son subdominios distintos y el navegador los trata como sitios distintos. Esto solo funciona si ambos sirven por **HTTPS** (Render lo hace automáticamente) — no lo pruebes por HTTP.

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

**Con `NODE_ENV=production` el servidor se niega a arrancar** si `JWT_SECRET`/`JWT_REFRESH_SECRET` son
cortos (<32 caracteres), iguales entre sí o parecen valores de ejemplo, si `DATABASE_URL` usa una contraseña
trivial, o si faltan las variables de Supabase.

| Variable | Obligatoria en producción | Para qué sirve |
|---|---|---|
| `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `SUPABASE_*` | Sí | Núcleo del sistema |
| `TWO_FACTOR_ENC_KEY` | Recomendada | Llave que cifra los secretos 2FA en la BD (si falta se deriva de `JWT_SECRET`; rotar éste sin fijar la llave invalidaría los 2FA existentes) |
| `BITACORA_RETENCION_DIAS` | No (365) | La bitácora se purga a diario (03:00); mínimo 30 días |
| `RESPALDOS_MAXIMO` | No (10) | Respaldos conservados; los más antiguos se eliminan |
| `ENABLE_API_DOCS` | No (`false`) | Publica Swagger (`/api/docs`) también en producción |
| `LOGIN_RATE_LIMIT_MAX` | No (20) | Intentos por IP y ventana de 15 min en cada endpoint de autenticación |
| `FOLIO_PREFIJO` | No (`SC`) | Prefijo de los folios de voluntario |

**Limitaciones conocidas a vigilar:**
- El rate limit y el bloqueo por IP usan memoria del proceso: con **más de una instancia** detrás de un balanceador cada una cuenta por separado (el bloqueo de cuenta por intentos fallidos sí es compartido, porque vive en la BD).
- Los respaldos usan `pg_dump`, que debe existir en el servidor. Con Supabase Storage configurado el archivo se sube al bucket (y se borra del disco local); sin él queda en `backups/`, que en Render es efímero.
- Recuperación de 2FA: si un usuario pierde su dispositivo, un super_admin puede reiniciarlo con `POST /api/usuarios/:id/2fa/reset`.

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

## WhatsApp: plantillas obligatorias (si vas a usar esta integración)

WhatsApp es **opcional** — sin configurar, SIGEVAC notifica por correo y funciona igual. Pero si lo activas, hay un requisito de Meta que no es evidente y que hace fallar la integración "silenciosamente" si se pasa por alto:

**Meta solo permite enviar texto libre dentro de una ventana de 24 horas que abre el usuario al escribirle primero a la empresa.** Todas las notificaciones de SIGEVAC (documento rechazado, expediente aprobado, documento por vencer) las inicia la asociación, no el voluntario — así que caen fuera de esa ventana y Meta las rechaza con el **error 131047**. La única forma de enviarlas es como **plantilla previamente aprobada**.

Pasos para dejarlo funcionando:

1. En **business.facebook.com → WhatsApp Manager → Plantillas de mensajes**, crea una plantilla:
   - **Categoría**: `Utilidad` (no `Marketing`; las de utilidad se aprueban más rápido y no requieren opt-in promocional).
   - **Idioma**: español (México) → el código es `es_MX`.
   - **Cuerpo**: un texto con **una sola variable**, por ejemplo:
     `Hola, tienes una notificación de SIGEVAC: {{1}}`
   - Meta suele aprobarla en minutos u horas.
2. Copia el **nombre exacto** de la plantilla a la variable `WHATSAPP_TEMPLATE_NOTIFICACION` en Render (y `WHATSAPP_TEMPLATE_IDIOMA=es_MX` si usaste otro idioma).
3. Configura también `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.
   > El token temporal que Meta muestra al principio **dura 24 horas**. Para producción genera un token permanente desde un *System User* en Business Settings, o la integración dejará de funcionar al día siguiente (error 190, que el backend ya traduce a un mensaje claro en los logs).
4. Mientras la cuenta esté en **modo de prueba**, Meta solo entrega a números que agregues a la lista de destinatarios permitidos (error 131030).

**Formato de teléfonos:** no hace falta que cambies nada. Los teléfonos se capturan como números locales de 10 dígitos (`2381234567`) y el backend los convierte al formato internacional que exige Meta (`522381234567`), tolerando espacios, guiones y paréntesis. Si un teléfono está incompleto, el envío se omite y queda registrado en los logs, en vez de mandarle el mensaje a un número equivocado. El código de país se ajusta con `WHATSAPP_CODIGO_PAIS` (52 por defecto).

**Cómo saber si está funcionando:** los envíos fallidos ya no se pierden en silencio — los logs del backend muestran el motivo exacto traducido (plantilla no aprobada, token vencido, número fuera de la lista de prueba, ventana cerrada), no solo "falló el envío".

## Geocodificación (buscador de lugares en actividades)

El formulario de actividades permite buscar una dirección, marcar un punto en el mapa y usar la ubicación actual del dispositivo. Usa **Nominatim (OpenStreetMap)**, que es gratuito y no pide API key, pero **tiene una política de uso que hay que respetar** o bloquea las peticiones con `403`:

- Exige un **User-Agent que identifique la aplicación** con un contacto real. Como los navegadores no permiten fijar ese header, las búsquedas **pasan por el backend** (`/api/geocodificacion/*`), que sí lo envía. Ajusta `NOMINATIM_USER_AGENT` con la URL o el correo de tu despliegue.
- El límite es de **1 petición por segundo sumando todos los usuarios** de la aplicación. El backend serializa las peticiones salientes para respetarlo y **cachea** los resultados 24 h (las búsquedas de la región se repiten mucho), además de limitar a 30 búsquedas por minuto por usuario.
- Si el proyecto llegara a tener tráfico alto, la salida es apuntar `NOMINATIM_URL` a una instancia propia o a un proveedor comercial — no hace falta tocar código.

El endpoint requiere sesión iniciada, para que el proxy no quede expuesto como servicio de geocodificación gratuito para terceros.

## Solución de problemas comunes

**Las fotos de la galería pública no cargan (ícono roto) o desaparecieron:**
Ver la sección "⚠️ Almacenamiento de archivos" al inicio de esta guía. Diagnóstico rápido:
1. En Render → `sigevac-api` → **Logs**, busca la línea de arranque. Si ves `⚠️ Almacenamiento de archivos: usando DISCO LOCAL`, faltan (o están mal escritas) las variables `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET`.
2. Corrígelas en **Environment**, guarda (Render redepliega solo) y vuelve a subir las fotos afectadas desde Administración → Galería — las que se subieron antes de corregir esto no se recuperan solas, porque el archivo original ya se perdió.

**El backend no arranca y el log dice `Faltan variables de producción: ...`:**
Es intencional (ver `app.js`) — completa esas variables en Render → Environment. Se dispara con `NODE_ENV=production` o automáticamente en Render (variable `RENDER=true`, la fija la plataforma sola).

**`CORS error` / `Access-Control-Allow-Origin` en la consola del navegador:**
`FRONTEND_URL` en el backend no coincide exactamente con la URL del sitio estático (revisa que no tenga una `/` al final, y que sea `https://`, no `http://`). Ver Paso 5.

**El login funciona pero `/api/auth/refresh` responde 401 constantemente / la sesión no persiste al recargar:**
Ambos servicios deben servir por HTTPS (Render lo hace automático) — la cookie del refresh token usa `SameSite=None; Secure` entre subdominios distintos, y eso no funciona por HTTP. Ver la nota de "Cookie de sesión entre subdominios" en el Paso 5.

**`/api/respaldos` responde 503:**
El entorno de Render no tiene instalado `pg_dump`. Ver la nota de "Respaldos" en el Paso 3.

**La primera carga tarda 30-60 segundos:**
Normal en el plan gratuito de Render (arranque en frío tras 15 min sin tráfico) — ver la tabla de limitaciones al inicio.

**Los mensajes de WhatsApp no llegan:**
Revisa los logs del backend, que ya traducen el error de Meta:
- `WhatsApp configurado pero sin WHATSAPP_TEMPLATE_NOTIFICACION` → falta crear/configurar la plantilla aprobada (ver sección "WhatsApp" arriba). Es el caso más común.
- *ventana de 24 h está cerrada* (error 131047) → se intentó enviar texto libre; debe ir por plantilla.
- *token inválido o expiró* (error 190) → estás usando el token temporal de 24 h; genera uno permanente de System User.
- *no está en la lista de destinatarios permitidos* (131030) → la cuenta sigue en modo de prueba en Meta.
- *Teléfono ausente o con formato no reconocible* → el teléfono del voluntario está incompleto en la base de datos.

**El buscador de lugares del formulario de actividades no encuentra nada / responde 503:**
Nominatim está limitando las peticiones. Verifica que `NOMINATIM_USER_AGENT` tenga un contacto real que resuelva (una URL o correo válidos) — un User-Agent genérico o con un dominio inexistente es motivo de bloqueo. Si el problema persiste con tráfico alto, apunta `NOMINATIM_URL` a una instancia propia o a un proveedor comercial. Mientras tanto, siempre se puede marcar la ubicación con un clic en el mapa, que no depende del buscador.
