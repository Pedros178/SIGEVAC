# SIGEVAC

**Sistema Integral para la Gestión de Expedientes y Voluntariado para Asociaciones Civiles**

Plataforma web para administrar de forma segura el registro de voluntarios, expedientes digitales, documentación, actividades, horas de servicio, reportes y estadísticas de asociaciones civiles.

Proyecto de residencia — Instituto Tecnológico de Tehuacán (ITT), en colaboración con la Asociación Juvenil "Sueños de Comedia", A.C., con sede en Huamantla, Tlaxcala.

## Stack tecnológico

- **Backend:** Node.js + Express (arquitectura MVC), PostgreSQL, JWT (access token en memoria + refresh token como cookie `httpOnly`)
- **Frontend:** React 18 + Vite, React Router, Leaflet/React-Leaflet (mapas), idb (IndexedDB) + Service Worker (modo offline / PWA)
- **Base de datos:** PostgreSQL (46 tablas, ver `backend/database/schema.sql`)
- **Calidad:** ESLint (backend y frontend), Jest + Supertest (backend, contra PostgreSQL real), Vitest + Testing Library (frontend), CI en GitHub Actions (lint, `npm audit`, tests, build)

## Funciones destacadas

- Dashboard operativo con tendencias mensuales de altas, horas de servicio y salud documental.
- Actualización automática de indicadores cada 60 segundos.
- Credencial digital con QR y certificado público de horas verificable sin iniciar sesión.
- Consulta pública: `/certificado?codigo=CODIGO_QR`.
- **Modo offline (PWA)**: la app instala un Service Worker y encola en IndexedDB las entradas/salidas de asistencia registradas sin conexión; se sincronizan automáticamente con el backend en cuanto vuelve la señal.
- **Geolocalización de actividades**: ubicación en mapa (Leaflet/OpenStreetMap, sin API key) al crear o editar una actividad, visible en el listado.
- **Gamificación**: insignias automáticas por horas, actividades completadas, antigüedad y racha; nivel del voluntario (bronce/plata/oro/platino) recalculable manualmente.
- **Gestión de riesgo de abandono**: indicador por voluntario y resumen por asociación, para detectar bajas de participación antes de que ocurran.

- CI con GitHub Actions: lint + `npm audit` + tests en backend y frontend, y build de producción del frontend, en cada push/PR.

## Estado del proyecto — 12 de 12 fases completadas ✅

| Fase | Contenido | Estado |
|------|-----------|--------|
| **1** | Autenticación, Usuarios/Roles, Asociación Civil | ✅ Implementado |
| **2** | Voluntarios, Expedientes digitales, Gestor de archivos | ✅ Implementado |
| **3** | Actividades, Participación, Horas, Credencial/QR | ✅ Implementado |
| **4** | Dashboard, Reportes, Notificaciones | ✅ Implementado |
| **5** | Auditoría, Bitácora, Configuración, Respaldo, API docs | ✅ Implementado |
| **6** | Firma electrónica, generación de documentos, portales, multi-asociación | ✅ Implementado |
| **7** | Multi-asociación real, alertas, ficha PDF/Excel, fotografía y OCR | ✅ Implementado |
| **8** | Inventario, cuotas, solicitudes públicas y 2FA | ✅ Implementado |
| **9** | Modo offline (PWA), geolocalización, gamificación y gestión de riesgo | ✅ Implementado |
| **10** | Página de inicio pública de la asociación | ✅ Implementado (galería con fotos de la asociación, editable desde Administración) |
| **11** | Inventario avanzado (categorías, fotos, préstamos y mantenimientos) | ✅ Implementado |
| **12** | Endurecimiento de seguridad, dependencias, galería e integraciones reales (WhatsApp, geocodificación) | ✅ Implementado |

## Estructura del repositorio

```
sigevac/
├── backend/
│   ├── database/
│   │   ├── schema.sql          # Esquema completo (46 tablas, todos los módulos)
│   │   ├── setup.js            # Aplica el esquema y todas las migraciones a la BD
│   │   ├── migrations/         # 001..017, incluye gamificación, geolocalización, inventario avanzado, galería e índices
│   │   └── seeds/
│   │       ├── 001_seed_base.sql
│   │       └── run.js          # Aplica seeds + crea usuario super_admin
│   ├── src/
│   │   ├── config/database.js
│   │   ├── controllers/        # authController, insigniaController, riesgoController, ...
│   │   ├── middlewares/        # auth (JWT), permisos (RBAC), validarArchivo, errorHandler
│   │   ├── models/             # capa de acceso a datos (SQL parametrizado)
│   │   ├── routes/
│   │   └── utils/              # jwt.js, password.js, cookies.js
│   ├── tests/                  # unit/ + integration/, 28 suites contra PostgreSQL real
│   ├── server.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── context/AuthContext.jsx
    │   ├── offline/             # IndexedDB + sincronizador (modo sin conexión)
    │   ├── pages/Login.jsx, Dashboard.jsx, Administracion.jsx, ...
    │   ├── components/          # PanelInsignias, PanelRiesgo, MapaActividades, ...
    │   ├── services/api.js      # axios + refresh automático de token (cookie httpOnly)
    │   └── App.jsx
    ├── vitest.config.js         # config de pruebas, separada de vite.config.js
    └── package.json
```

> ¿Buscas desplegar SIGEVAC en producción con una URL pública? Ve la guía completa en [DEPLOY.md](./DEPLOY.md) (Supabase + Render, 100% gratuito, sin tarjeta de crédito).

## Puesta en marcha

### 1. Base de datos

```bash
# Crea una base de datos PostgreSQL vacía, por ejemplo:
createdb sigevac
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edita .env con tu DATABASE_URL y secretos JWT

npm install
npm run db:setup     # Crea el esquema y aplica las migraciones
npm run db:seed      # Roles, permisos, catálogos, asociación y usuario super_admin

npm run dev           # http://localhost:4000
```

Usuario inicial: el correo sale de `SEED_ADMIN_EMAIL` (por defecto `admin@suenosdecomedia.org`).
Si `SEED_ADMIN_PASSWORD` está vacío en `.env`, **`npm run db:seed` genera una contraseña aleatoria y la
muestra una sola vez en la consola** (cópiala en ese momento). Si prefieres fijarla tú, debe cumplir la
política de contraseñas; el valor de ejemplo público `Sigevac#2026` se rechaza en producción.
Cámbiala tras el primer login desde *Administración → Cambiar contraseña* (`POST /api/auth/change-password`).

> `npm run db:setup` es **idempotente**: registra cada migración aplicada en la tabla `schema_migrations`
> y puede ejecutarse en cada despliegue; solo aplica lo pendiente (cada migración en su propia transacción).

> Cuentas de demostración (`npm run db:seed:demo`, contraseña pública `Demo#2026`): **solo para desarrollo**;
> el script se niega a correr con `NODE_ENV=production`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

### 4. Verificar que todo funciona (antes de tocar código o hacer un PR)

```bash
# Backend — crea una base de datos AISLADA solo para pruebas (se borra y recrea en cada corrida)
createdb sigevac_jest
cd backend
cp .env.test.example .env.test   # ya apunta a sigevac_jest por defecto
npm run lint
npm test                          # 28 suites / 244 pruebas contra PostgreSQL real

# Frontend
cd ../frontend
npm run lint
npm test                          # 10 suites / 56 pruebas
npm run build                     # confirma que compila para producción
```

Si las cuatro cosas (`lint` y `test` de ambos proyectos) terminan en verde, el proyecto está en el mismo estado que se validó antes de subirlo.

## Módulo 1 y 2 — Autenticación y seguridad implementadas

- Login con JWT: access token de vida corta (15 min) devuelto en el cuerpo de la respuesta y guardado **solo en memoria** en el frontend (nunca en `localStorage`); refresh token de 7 días entregado exclusivamente como cookie `httpOnly` (`sigevac_refresh`), inaccesible desde JavaScript incluso ante un XSS
- Validación real del contenido de los archivos subidos (no solo la extensión/`mimetype` declarados por el cliente), vía lectura de los primeros bytes del archivo
- Bloqueo temporal de cuenta tras intentos fallidos configurables (`MAX_INTENTOS_FALLIDOS`, `BLOQUEO_MINUTOS`)
- Recuperación de contraseña por token de un solo uso con expiración de 1 hora
- Rate limiting en `/auth/login` y `/auth/forgot-password`
- Contraseñas con bcrypt (12 rounds), tokens de recuperación con SHA-256
- Control de acceso por rol (`requiereRol`) y por permiso granular (`requierePermiso`)
- 6 roles predefinidos: `super_admin`, `presidente`, `coordinador`, `capturista`, `supervisor`, `consulta`

La asociación inicial se configura como **Asociación Juvenil "Sueños de Comedia", A.C.**, con municipio **Huamantla** y estado **Tlaxcala**. Al registrar un voluntario se pueden escribir libremente su estado y municipio; el sistema reutiliza o crea las referencias del catálogo.

## Fase 2 — Voluntarios, Expedientes y Gestor de archivos (Módulos 4–9)

- **Registro de voluntarios** con folio automático (`SC-AAAA-0001`), edad calculada desde la fecha de nacimiento, teléfonos fijo/celular, estado y municipio, detección de mayoría/minoría de edad y datos de tutor obligatorios para menores (Módulo 6)
- **Clasificación** por tipo de voluntario (Módulo 5): mayor/menor, servicio social, residencia, temporal, permanente, coordinador, instructor
- **Expediente digital automático**: al registrar un voluntario, el sistema crea su expediente y las filas de documentos requeridos según aplique (mayor/menor/ambos)
- **Gestor de archivos con versionado** (Módulo 8): cada carga de documento genera una nueva versión, conservando el historial completo
- **Semáforo de expediente** (Módulo 9): 🔴 incompleto / 🟡 en revisión / 🟢 completo, con porcentaje de avance recalculado automáticamente en cada carga, aprobación o rechazo de documento
- **Flujo de aprobación/rechazo** de documentos con motivo obligatorio en caso de rechazo
- Frontend: listado de voluntarios con búsqueda, alta con formulario condicional (tutor si es menor), y vista de expediente con carga de archivos y aprobación en un clic

Todo este flujo fue probado de extremo a extremo contra una base de datos PostgreSQL real (login → alta de voluntario menor con tutor → verificación de los 8 documentos aplicables → carga de archivo → aprobación → recálculo de semáforo → descarga autenticada).

### Notas técnicas encontradas durante las pruebas

- **Columnas generadas y `CURRENT_DATE`**: PostgreSQL no permite `GENERATED ALWAYS AS (...) STORED` con `CURRENT_DATE` porque no es una expresión inmutable. `es_menor_edad` se calcula en la aplicación al crear/actualizar el registro, no en la base de datos.
- **`dotenv` y el carácter `#`**: cualquier valor en `.env` que contenga `#` (por ejemplo, una contraseña como `Sigevac#2026`) debe ir entre comillas dobles, porque `dotenv` lo interpreta como inicio de comentario incluso sin espacio previo.
- **Multer**: se usa la versión 2.x (la 1.x tiene vulnerabilidades conocidas sin parchear).

## Fase 3 — Actividades, Horas de servicio y Credencial digital (Módulos 10–14)

- **Actividades** (Módulo 10): alta, edición, listado con filtro de fechas y control de cupo.
- **Evidencias fotográficas**: carga real de archivos (no solo URL) reutilizando el gestor de archivos del Módulo 8, con el mismo control de tipo y tamaño.
- **Participación** (Módulo 11): inscripción de voluntarios a actividades, con búsqueda en vivo desde el frontend.
- **Registro de asistencia**: entrada y salida por participación, con cálculo automático de horas realizadas dentro de una transacción de base de datos.
- **Horas de servicio** (Módulo 12): acumulación automática por voluntario, tipo (`servicio_social`, `residencia` o `voluntariado`, según su clasificación) y periodo mensual, sin intervención manual.
- **Credencial digital y QR** (Módulos 13–14): generación/renovación de credencial con vigencia de 12 meses, código QR único por voluntario (imagen PNG en base64) y endpoint de validación de identidad por escaneo de credencial.

Todo el flujo de esta fase (crear actividad → inscribir voluntario → registrar entrada → registrar salida con cálculo real de horas → verificar acumulado por periodo → generar credencial con QR → validar identidad escaneando el código → subir evidencia fotográfica) fue probado de extremo a extremo contra PostgreSQL real.

## Fase 4 — Dashboard, Reportes y Notificaciones (Módulos 15–17)

- **Dashboard** (Módulo 16): indicadores en tiempo real (voluntarios activos, nuevos del mes, expedientes por estado, actividades del mes, horas totales acumuladas, documentos faltantes), calculados directamente en PostgreSQL, sin cachés intermedias.
- **Reportes** (Módulo 15): 10 reportes (voluntarios activos/inactivos, expedientes completos/pendientes, horas acumuladas, participación por actividad, documentos faltantes, voluntarios por municipio, menores, mayores), cada uno exportable en **JSON, CSV, Excel (.xlsx) y PDF** desde el mismo endpoint (`?formato=`).
- **Notificaciones** (Módulo 17): servicio de correo con degradación elegante — si no hay SMTP configurado en `.env`, el sistema sigue funcionando y solo registra el intento en consola, sin romper el flujo. Se dispara automáticamente al rechazar un documento, al completarse un expediente, y al crear una nueva actividad; además hay un endpoint manual para recordar documentos faltantes.
- Frontend: Dashboard conectado a indicadores reales, página de Reportes con vista previa y descarga en los 3 formatos de archivo, y una campanita de notificaciones con contador de no leídas en la barra de navegación.

Todo el flujo de esta fase (consultar dashboard → generar cada reporte en sus 4 formatos → crear actividad y verificar notificación interna → rechazar documento y verificar intento de correo → notificar documentos faltantes → marcar notificación como leída) fue probado de extremo a extremo contra PostgreSQL real. Durante las pruebas se encontró y corrigió un bug: las fechas exportadas se mostraban con formato JavaScript verboso (`Fri Jan 01 2010...`) en vez de una fecha legible; se corrigió formateando las fechas directamente en SQL con `to_char(..., 'YYYY-MM-DD')`.

## Fase 5 — Auditoría, Bitácora, Configuración, Respaldo y API docs (Módulos 18–22)

- **Trazabilidad automática** (`src/middlewares/trazabilidad.js`): se monta una sola vez en `server.js` y registra, sin bloquear ni retrasar la respuesta (usa el evento `finish` de Express):
  - **Bitácora** (Módulo 21): toda petición autenticada, exitosa o no.
  - **Auditoría** (Módulo 18): solo operaciones que modifican datos (POST/PUT/PATCH/DELETE) que tuvieron éxito, con el cuerpo de la petición sanitizado (contraseñas y tokens nunca se registran).
- **Configuración** (Módulo 19): pares clave/valor por asociación, editables desde el panel de administración.
- **Respaldo** (Módulo 20): genera un dump real de PostgreSQL con `pg_dump` (formato plano), lo registra en la tabla `respaldos` y permite descargarlo — funcionalidad reservada al rol `super_admin`. El servidor debe tener `pg_dump` instalado y disponible en el `PATH`.
- **Documentación de la API** (Módulo 22): especificación OpenAPI 3.0 servida con Swagger UI en `/api/docs`, cubriendo los endpoints de las Fases 1 a 5.
- Frontend: página de Administración con pestañas para Auditoría, Bitácora, Configuración y Respaldos (con descarga directa del dump).

Todo el flujo de esta fase fue probado contra PostgreSQL real. Para generar respaldos en Windows o Linux, instala las herramientas cliente de PostgreSQL y verifica `pg_dump --version` antes de usar el botón de respaldo.

## Fase 6 — Diferenciadores (firma electrónica, plantillas, portal, multi-asociación)

- **Generación automática de documentos** desde plantilla institucional (PDF vía `pdfkit`): carta responsiva, aviso de privacidad, reglamento interno, uso de imagen y carta de autorización del tutor, con los datos del voluntario ya rellenados. *Nota: son plantillas base; se recomienda su revisión por un asesor legal de la asociación antes de un uso oficial.*
- **Firma electrónica simple**: captura del trazo en un `<canvas>` del navegador, guardada como PNG junto con el nombre del firmante, IP y user-agent, como acuse de conformidad sobre el documento vigente.
- **Portal del voluntario/tutor**: acceso sin contraseña mediante "enlace mágico" (JWT de 24 h enviado por correo), donde el propio voluntario —o el tutor, si es menor de edad, usando el correo registrado como tutor— puede consultar su expediente y subir sus documentos pendientes. Verificado que un voluntario **no puede** subir documentos al expediente de otro (403).
- **Preparación multi-asociación**: revisado que el aislamiento por `asociacion_id` ya está aplicado consistentemente en voluntarios, actividades, dashboard y reportes desde las fases anteriores.

> **Actualización posterior a esta fase:** la limitación de "un usuario, una sola asociación" descrita arriba **ya se resolvió**. Ver la sección [Fase 7 — Multi-asociación real y mejoras post-residencia](#fase-7--multi-asociación-real-y-mejoras-post-residencia) más abajo.

Todo el flujo de esta fase (generar un documento desde plantilla y verificar el PDF resultante → firmar un documento y recuperar la firma → solicitar acceso al portal, consultar el expediente propio y subir un documento → verificar que el portal rechaza el acceso sin token y el intento de subir un documento ajeno) fue probado de extremo a extremo contra PostgreSQL real.

## Fase 7 — Multi-asociación real y mejoras post-residencia

Después de la Fase 6 se agregaron las siguientes funciones, con el mismo criterio de "probado de extremo a extremo" que las fases anteriores:

- **Multi-asociación real (N:M)**: nueva tabla `usuario_asociaciones`; un usuario puede pertenecer a varias asociaciones civiles, con una marcada como predeterminada. Endpoint `POST /api/auth/asociacion-activa` para cambiar de asociación activa sin volver a iniciar sesión (reemite access y refresh token). Aislamiento de datos verificado con pruebas automatizadas (ver `tests/integration/multiAsociacion.test.js`).
- **Registro de asociaciones civiles** (Módulo 3, pendiente desde la propuesta original): `POST /api/asociacion`, reservado a `super_admin`.
- **UI diferenciada por rol**: el menú de navegación, las pestañas de Administración y los botones de acción (crear voluntario, aprobar/rechazar documento, editar configuración) ahora se muestran u ocultan según los permisos reales del usuario autenticado, en vez de mostrar el mismo panel a los 6 roles.
- **Alertas de vigencia de documentos** (Módulo 17): job diario (`node-cron`, 8:00 a.m.) que revisa documentos aprobados por vencer y notifica al voluntario y a la asociación; además de un endpoint manual (`POST /api/configuracion/vigencias/revisar`) para forzar la revisión.
- **Ficha del integrante**: `GET /api/voluntarios/:id/ficha.pdf` y `.../ficha.xlsx` — genera automáticamente una ficha con foto, datos, estado del expediente y código QR, lista para imprimir o exportar.
- **Fotografía de perfil del voluntario**: endpoint de carga (`POST /api/voluntarios/:id/foto`) y de consulta autenticada (`GET /api/voluntarios/:id/foto`) — el campo existía en el esquema desde el inicio pero nunca se había conectado.
- **Escáner de documentos con OCR**: recorte y enderezado automático de fotos tomadas con celular (OpenCV.js) y lectura opcional del CURP por reconocimiento óptico de caracteres (Tesseract.js), ambos ejecutados en el navegador. El texto reconocido siempre se muestra como sugerencia editable, nunca se guarda automáticamente sin revisión.
- **Rebranding**: paleta de colores e identidad visual de la Asociación Juvenil "Sueños de Comedia, A.C." aplicada en toda la interfaz y en los documentos generados (PDF/Excel).

## Roadmap de módulos (23 totales, ver especificación completa)

El esquema de base de datos (`schema.sql`) ya contempla las tablas de **todos** los módulos (voluntarios, tutores, expedientes, documentos, archivos, actividades, participaciones, asistencias, horas de servicio, credenciales, QR, notificaciones, auditoría, bitácora, configuración, respaldos), para que cada fase futura solo agregue modelos/controladores/rutas sin migrar el esquema desde cero.

## Multi-asociación

El sistema soporta múltiples asociaciones civiles bajo una sola instalación: las tablas clave (`usuarios`, `voluntarios`, `actividades`, `configuracion`) incluyen `asociacion_id` como llave foránea, y la tabla `usuario_asociaciones` (N:M) permite que un mismo usuario pertenezca a más de una asociación y cambie entre ellas desde la barra de navegación. Ver la sección "Fase 7" arriba para el detalle.

## Pruebas automatizadas

El backend cuenta con una suite de pruebas automatizadas con **Jest** y **Supertest**, ejecutada contra una base de datos PostgreSQL real y aislada (`sigevac_jest`), nunca contra la base de datos de desarrollo.

```bash
cd backend
npm test              # corre toda la suite
npm run test:coverage # corre la suite y genera reporte de cobertura (texto + HTML en /coverage)
```

- **Pruebas unitarias** (`tests/unit/`): funciones puras sin dependencia de base de datos — hashing y comparación de contraseñas, generación/verificación de JWT (access, refresh y token de portal), y los tres formatos de exportación de reportes (CSV, Excel, PDF).
- **Pruebas de integración** (`tests/integration/`): peticiones HTTP reales contra la API completa (Supertest + Express), cubriendo autenticación, RBAC, registro de voluntarios y expediente automático, gestor de archivos y semáforo, actividades/horas de servicio/credencial QR, reportes, configuración, notificaciones, los diferenciadores de la Fase 6 (plantillas, firma electrónica y Portal) y las funciones de la Fase 7 (multi-asociación con verificación de aislamiento de datos, alertas de vigencia, ficha PDF/Excel y fotografía de perfil). Incluye la prueba de seguridad más crítica del sistema: **un voluntario del Portal no puede subir documentos al expediente de otro voluntario**.
- La base de datos de pruebas se recrea desde cero en cada corrida (`globalSetup`), aplicando el esquema completo y los seeds, con un usuario `super_admin` de pruebas con contraseña conocida.

Durante la construcción de esta suite se encontró y corrigió un bug real: `POST /api/actividades/:id/participaciones` permitía inscribir dos veces al mismo voluntario a la misma actividad sin avisar (la inserción con `ON CONFLICT DO NOTHING` devolvía silenciosamente el registro existente). Se corrigió para responder `409 Conflict` con un mensaje claro.

Las pruebas de integración recrean una base aislada, aplican `schema.sql` y todas las migraciones, y verifican los flujos principales, incluido el aislamiento entre asociaciones.

## Fase 8 — Inventario, Cuotas, Solicitudes y 2FA (revisión y correcciones)

Estos módulos ya existían en el código (backend, migraciones y pestañas dentro de Administración) antes de esta fase. Aquí se revisaron a fondo, se les escribió su primera suite de pruebas, y se corrigieron **tres bugs reales** encontrados durante esa revisión:

1. **2FA completamente roto**: `authController.js` importaba `otplib` usando funciones sueltas y asíncronas (`generateSecret`, `generateURI`, `verify`) que no existen en esa librería — la API real es el objeto `authenticator` (`authenticator.generateSecret()`, `authenticator.keyuri()`, `authenticator.verify({ token, secret })`, todas síncronas). Con el código original, `POST /auth/2fa/setup` habría fallado con un `TypeError` en cuanto alguien lo usara por primera vez. Corregido.
2. **Registrar un pago de cuota nunca funcionaba**: `cuotaController.registrarPago` reenviaba `cuota_id`/`voluntario_id` (snake_case, tal cual los manda el frontend) directo a `CuotaModel.registrarPago`, que esperaba `cuotaId`/`voluntarioId` (camelCase). El resultado: la consulta SQL siempre comparaba contra `NULL` y el endpoint respondía "la cuota y el voluntario no pertenecen a la misma asociación" sin importar los datos enviados. Corregido, con prueba de regresión (`inventarioCuotasSolicitudes.test.js`).
3. **`schema.sql` no incluía Inventario, Cuotas ni Solicitudes**: estas tablas solo existían como migraciones sueltas (`004_inventario_cuotas.sql`, `005_solicitudes.sql`). Una instalación nueva con `npm run db:setup` se quedaba sin esos módulos por completo, aunque el código de la API y del frontend ya los soportaran. Se fusionaron al esquema principal.

Además se completó lo que faltaba para que estos módulos fueran usables de extremo a extremo:

- **Formulario público de solicitud de voluntariado** (`/solicitud`): el backend ya aceptaba solicitudes sin autenticación desde que se agregó el módulo, pero no existía ninguna pantalla para enviarlas — solo el panel de revisión en Administración. Se agregó la página, un enlace desde el login, y un endpoint público mínimo (`GET /api/asociacion/publicas`, solo id+nombre, sin datos sensibles) para que el formulario sepa a qué asociación aplicar.
- **Botón para desactivar 2FA**: el panel de seguridad solo permitía activarlo, nunca desactivarlo desde la interfaz (el endpoint `POST /auth/2fa/disable` existía en el backend pero nada lo llamaba).

## Fase 9 — Modo offline, geolocalización, gamificación, riesgo y endurecimiento de seguridad

Esta fase surgió de **fusionar dos ramas del proyecto que habían divergido del mismo punto**: una avanzó en funcionalidad nueva, la otra en seguridad, pruebas y CI. Se combinaron ambas, verificando cada pieza con la suite de pruebas real (Postgres) y build de producción antes de darla por buena.

### Funcionalidad nueva

- **Modo offline (PWA)** (`frontend/src/offline/`): las entradas/salidas de asistencia registradas sin conexión se encolan en IndexedDB (`idb`) y se sincronizan solas al recuperar la señal, con un indicador de conexión visible en la barra de navegación. La app es instalable (`vite-plugin-pwa` + Service Worker).
- **Geolocalización de actividades**: selector de ubicación en mapa al crear/editar una actividad (Leaflet + OpenStreetMap, sin API key ni costo) y visualización en el listado.
- **Gamificación**: insignias automáticas por horas acumuladas, actividades completadas, antigüedad y racha de participación; nivel del voluntario (bronce/plata/oro/platino) recalculable manualmente desde su expediente.
- **Gestión de riesgo de abandono**: indicador individual por voluntario y panel resumen por asociación, pensado para detectar caídas de participación antes de que se conviertan en bajas.
- **Servir evidencias correctamente**: bug real corregido — las evidencias fotográficas de actividades se subían pero no existía ningún endpoint para volver a verlas (`GET /api/evidencias/:id`), protegido por su propio control de aislamiento por asociación.

### Endurecimiento de seguridad y calidad (reincorporado desde la rama de "ci-calidad")

- **Refresh token de vuelta en cookie `httpOnly`**: había quedado temporalmente en el cuerpo de la respuesta/`localStorage` en la rama de funcionalidad nueva, lo que exponía un token de 7 días de vigencia a robo por XSS. Se restauró el flujo original: access token en memoria, refresh token en cookie `httpOnly` con `SameSite`/`Secure` según entorno.
- **Validación real de archivos subidos** (`middlewares/validarArchivo.js`, reconectada en las 4 rutas que reciben archivos): verifica el contenido real del archivo, no solo la extensión o el `Content-Type` declarados por quien sube el archivo.
- **Índices de rendimiento/seguridad** en sesiones, tokens de recuperación, actividades y bitácora (antes se habían perdido al no fusionar esa migración).
- **ESLint, `npm audit` y pruebas de frontend de vuelta en CI** — se habían quitado del pipeline de GitHub Actions en la rama de funcionalidad nueva; el pipeline ahora corre lint + `npm audit` (informativo, ver [DEPLOY.md](./DEPLOY.md)) + tests + build en cada push/PR, para ambos proyectos.
- **Bug real encontrado y corregido durante la fusión**: en `Login.jsx`, el botón para confirmar el código de 2FA no se renderizaba en absoluto — un cambio de estructura del formulario lo había dejado dentro de la rama incorrecta del condicional, así que nadie podía completar el login con 2FA activo. Lo detectó la prueba automatizada de `Login.test.jsx` restaurada; se corrigió sacando el botón del condicional (aplica a ambos pasos del login).

Tras la fusión, la suite completa del backend (23 suites / 188 pruebas) corre en verde contra PostgreSQL real, y la del frontend (6 suites / 33 pruebas) también, incluyendo el build de producción con el Service Worker generado correctamente.

## Fase 10 — Página de inicio pública

El sitio ya no abre directamente en el login. La raíz (`/`) es ahora la
página pública de la asociación: quiénes somos, misión/visión, las ~19
áreas de labor, próximas actividades (en vivo desde el sistema, sin
necesitar sesión) y contacto. Desde ahí, dos botones llevan al uso interno:

```
/                → Página pública de la asociación (Home.jsx)
/login           → Login (ahora recuerda a dónde ibas y te regresa ahí tras entrar)
/dashboard       → Dashboard (antes vivía en "/")
/inventario      → Inventario (antes era una pestaña dentro de Administración)
/voluntarios ...           → resto del sistema, sin cambios
```

**Backend:** nuevo endpoint público `GET /api/publico/actividades` (sin
autenticación) que devuelve hasta 6 próximas actividades no canceladas,
solo con campos seguros para mostrar (nunca el responsable ni el total de
inscritos). Como esta instalación está pensada para una sola asociación de
cara al público, se resuelve cuál mostrar vía `ASOCIACION_PUBLICA_ID`
(opcional en `.env`) o, si no se define, la asociación más antigua.

**Galería:** tiene una galería de respaldo con fotos reales de la asociación (`frontend/public/galeria/`) para que la sección nunca se vea vacía, y desde Administración → Galería se pueden subir, publicar/ocultar y ordenar fotos reales que la reemplazan automáticamente en el Home. Si una foto puntual deja de estar disponible en el almacenamiento, se descarta sola de la vista en vez de mostrarse rota (ver "Almacenamiento de archivos" en [DEPLOY.md](./DEPLOY.md) si esto te pasa en producción).

## Fase 11 — Inventario avanzado (categorías, fotos, préstamos y mantenimientos)

Se exploraron en paralelo dos implementaciones del inventario avanzado
(categorías/subcategorías, código QR/SKU, préstamos formales,
mantenimientos) y esta fase fusiona lo mejor de ambas:

- **Base:** categorías con subcategorías anidadas (p.ej. Vestuario >
  Sombreros), fotos por artículo, SKU y código QR autogenerados al crear
  el artículo (sin paso extra), y control de acceso por permiso
  (`inventario.consultar` / `inventario.gestionar`) en vez de "solo
  super_admin".
- **`es_prestable` (columna nueva):** distingue artículos consumibles
  (papelería, material de limpieza — solo existencias/movimientos) de
  artículos prestables (vestuario, escenografía, equipo). Intentar
  registrar un préstamo sobre un artículo no marcado como prestable
  responde 400.
- **Vínculo real con voluntario/actividad:** un préstamo ahora puede
  ligarse a un `voluntario_id` y/o `actividad_id` reales del sistema
  (antes solo se guardaba el nombre del responsable como texto libre).
  El nombre del responsable se sigue guardando aparte, así el historial
  del préstamo se conserva legible aunque el voluntario se borre después.
- **Búsqueda por QR enriquecida:** además del artículo, ahora devuelve su
  historial de movimientos y mantenimientos, útil para revisar el estado
  de una pieza en campo antes de decidir prestarla.

**Nota de origen:** durante la fusión se detectó que una de las dos
implementaciones tenía una inconsistencia entre su documentación (que
afirmaba haber reemplazado el candado de "solo super_admin" por permisos
granulares) y su código real de navegación (que seguía restringiendo por
rol). Esta versión fusionada usa el modelo de permisos consistentemente
en backend y frontend.

**Pruebas:** se añadió cobertura de integración para el candado de
`es_prestable`, la doble devolución de un préstamo (debe responder 404),
el vínculo préstamo↔actividad, y la respuesta del QR con historial; y
pruebas de frontend (Vitest + RTL) para el nuevo checkbox, el filtrado
del selector de préstamos y el flujo de préstamo/devolución.

**Pendiente:** falta interfaz para elegir un voluntario/actividad real
al registrar un préstamo (por ahora el backend ya lo admite, pero el
formulario solo captura el nombre en texto libre); y un endpoint para
eliminar categorías (una de las dos implementaciones lo tenía, no se
incluyó aquí para no ampliar el alcance sin definirlo primero).

## Fase 12 — Endurecimiento de seguridad, dependencias, galería e integraciones externas

Revisión de seguridad end-to-end del proyecto ya terminado, con tres objetivos: cerrar vulnerabilidades de dependencias, endurecer puntos débiles encontrados en la revisión, y diagnosticar por qué las fotos de la galería pública dejaban de cargar en producción.

### Dependencias

`npm audit` quedó en **0 vulnerabilidades en ambos proyectos** (antes: `qs`/`multer`/`nodemailer` en backend, `react-router-dom`/`vite`-`esbuild` en frontend). El detalle completo, incluida la justificación de cada salto de versión y por qué no rompió nada, está en [DEPLOY.md](./DEPLOY.md#estado-de-seguridad-de-las-dependencias).

### Seguridad

- **CSP de Helmet rompía `/api/docs`**: `swagger-ui-express` inyecta un script inline que el CSP estricto por defecto bloqueaba, dejando la documentación en blanco. Se relajó el CSP solo en esa ruta.
- **`/reset-password` sin límite de tasa**: era la única ruta de autenticación sin protección contra fuerza bruta; ya tiene el mismo límite que `/login`.
- **HTML sin escapar en 5 plantillas de correo**: el nombre del voluntario (que puede originarse en el formulario público de solicitud) se interpolaba sin escapar. Se agregó `escaparHtml()` en `utils/email.js`.
- **`POST /solicitudes` (formulario público) sin límite de tasa ni validación de formato de correo**: corregido con el mismo criterio que el resto de endpoints públicos.
- **Política de contraseñas centralizada** (`validarFortalezaPassword`, alineada a NIST SP 800-63B): longitud mínima/máxima y blocklist de contraseñas triviales, aplicada de forma consistente en creación de usuarios y reset-password.
- **Refuerzo anti-CSRF** (`middlewares/verificarOrigen.js`) en `/auth/refresh` y `/auth/logout` — los únicos endpoints autenticados solo por cookie —, verificando el header `Origin` cuando el navegador lo envía.

### Bug real encontrado y corregido: fotos de la galería que dejaban de cargar

**Síntoma:** fotos publicadas desde Administración → Galería que en algún momento dejaban de verse en la página pública (ícono de imagen rota), reemplazando incluso a las fotos de respaldo que sí funcionaban.

**Causa raíz:** el registro de la foto vive en PostgreSQL (persistente), pero el archivo en sí se había guardado en el disco local del contenedor — que en Render (plan gratuito) se borra en cada reinicio/redeploy/hibernación si no se configuró Supabase Storage. El backend seguía sirviendo la foto en el listado (viene de la base de datos) pero el endpoint de la imagen respondía 404 al no encontrar el archivo.

**Corrección, en dos capas:**
1. **Backend, a prueba de errores** (`app.js`): la validación de variables obligatorias de producción ahora también se dispara al detectar `RENDER=true` (variable que Render fija sola en todos sus servicios), no solo con `NODE_ENV=production` — así ya no es posible desplegar en Render sin almacenamiento persistente por descuido. `server.js` además imprime una advertencia visible en cada arranque si detecta que está guardando archivos en disco local.
2. **Frontend, tolerante a fotos rotas** (`Home.jsx`): si una foto puntual falla al cargar, se descarta de la vista automáticamente (con prueba de regresión); si terminan fallando todas, vuelve a la galería de respaldo en vez de dejar la sección vacía o rota.

Detalle completo del diagnóstico y qué hacer si ya existen fotos "fantasma" de antes de este arreglo: [DEPLOY.md, sección "Almacenamiento de archivos"](./DEPLOY.md#️-almacenamiento-de-archivos-galería-documentos-respaldos--leer-antes-de-subir-fotos-reales).

### Integraciones externas corregidas (WhatsApp y geocodificación)

Ambas integraciones ya usaban APIs reales (Meta Cloud API y Nominatim/OpenStreetMap), pero ninguna cumplía los requisitos que esos servicios imponen en producción:

- **WhatsApp — las notificaciones nunca habrían llegado.** Meta solo acepta texto libre dentro de la ventana de 24 h que abre el usuario al escribir primero; todas las notificaciones de SIGEVAC las inicia la asociación, así que Meta las rechazaba con el error 131047. Ahora se envían como **plantilla aprobada** (`type: template`). Además: los teléfonos, capturados como números locales de 10 dígitos, se **normalizan al formato internacional** que exige Meta (antes se enviaban tal cual y no habrían llegado), los errores de Meta se traducen a mensajes accionables en los logs (plantilla no aprobada, token vencido, número en modo prueba) y los envíos fallidos ya no se descartan en silencio.
- **Geocodificación — el buscador se habría bloqueado con el uso.** La política de Nominatim exige un User-Agent identificable (que el navegador no permite fijar) y limita a 1 req/s para *toda* la aplicación, no por usuario; se llamaba directamente desde el navegador, sin identificar y sin control de tasa, lo que lleva a un bloqueo por `403`. Ahora pasa por un **proxy en el backend** (`/api/geocodificacion`) que envía el User-Agent correcto, serializa las peticiones a 1/s, cachea 24 h y limita por usuario. Se agregó además **geocodificación inversa**: al marcar un punto en el mapa se obtiene el nombre del lugar, en vez de dejar solo coordenadas.

Ambas quedan configurables por variables de entorno (plantilla e idioma de WhatsApp, código de país, User-Agent y proveedor de geocodificación), documentadas en `backend/.env.example` y en [DEPLOY.md](./DEPLOY.md).

Verificado con la suite completa: **244/244 pruebas backend, 56/56 pruebas frontend**, lint sin errores en ambos proyectos, build de producción del frontend limpio.


## Pruebas

| Qué | Comando |
|---|---|
| Backend (unitarias + integración, requiere PostgreSQL de pruebas) | `cd backend && npm test` |
| Frontend | `cd frontend && npm test` |
| Navegador real (extremo a extremo) | `cd e2e && npm install && npm test` (ver cabecera de `e2e/run.js`) |
| Despliegue publicado (HTTPS, CORS, cookies, archivos expuestos) | `cd backend && npm run smoke` |
| Restauración de respaldos | `npm run db:restore` / `npm run db:verify-restore` (ver `OPERACION.md`) |
