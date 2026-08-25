# SIGEVAC

**Sistema Integral para la Gestión de Expedientes y Voluntariado para Asociaciones Civiles**

Plataforma web para administrar de forma segura el registro de voluntarios, expedientes digitales, documentación, actividades, horas de servicio, reportes y estadísticas de asociaciones civiles.

Proyecto de residencia — Instituto Tecnológico de Tehuacán (ITT), en colaboración con la Asociación Juvenil "Sueños de Comedia", A.C., con sede en Huamantla, Tlaxcala.

## Stack tecnológico

- **Backend:** Node.js + Express (arquitectura MVC), PostgreSQL, JWT (access + refresh tokens)
- **Frontend:** React 18 + Vite, React Router
- **Base de datos:** PostgreSQL (39 tablas, ver `backend/database/schema.sql`)

## Funciones destacadas

- Dashboard operativo con tendencias mensuales de altas, horas de servicio y salud documental.
- Actualización automática de indicadores cada 60 segundos.
- Credencial digital con QR y certificado público de horas verificable sin iniciar sesión.
- Consulta pública: `/certificado?codigo=CODIGO_QR`.
- CI con GitHub Actions para ejecutar pruebas del backend y build de producción del frontend.

## Estado del proyecto — 8 de 8 fases completadas ✅

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

## Estructura del repositorio

```
sigevac/
├── backend/
│   ├── database/
│   │   ├── schema.sql          # Esquema completo (39 tablas, todos los módulos)
│   │   ├── setup.js            # Aplica el esquema a la BD
│   │   └── seeds/
│   │       ├── 001_seed_base.sql
│   │       └── run.js          # Aplica seeds + crea usuario super_admin
│   ├── src/
│   │   ├── config/database.js
│   │   ├── controllers/        # authController, usuarioController, asociacionController
│   │   ├── middlewares/        # auth (JWT), permisos (RBAC), errorHandler
│   │   ├── models/             # capa de acceso a datos (SQL parametrizado)
│   │   ├── routes/
│   │   └── utils/              # jwt.js, password.js
│   ├── server.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── context/AuthContext.jsx
    │   ├── pages/Login.jsx, Dashboard.jsx
    │   ├── services/api.js     # axios + refresh automático de token
    │   └── App.jsx
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

Usuario inicial (definido en `.env` como `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`):
`admin@suenosdecomedia.org` / `Sigevac#2026` — **cámbiala después del primer login**.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

## Módulo 1 y 2 — Autenticación y seguridad implementadas

- Login con JWT (access token de vida corta + refresh token de 7 días)
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
