# SIGEVAC

**Sistema Integral para la Gestión de Expedientes y Voluntariado para Asociaciones Civiles**

Plataforma web para administrar de forma segura el registro de voluntarios, expedientes digitales, documentación, actividades, horas de servicio, reportes y estadísticas de asociaciones civiles.

Proyecto de residencia — Instituto Tecnológico de Tehuacán (ITT), en colaboración con la Asociación Juvenil "Sueños de Comedia", A.C.

## Stack tecnológico

- **Backend:** Node.js + Express (arquitectura MVC), PostgreSQL, JWT (access + refresh tokens)
- **Frontend:** React 18 + Vite, React Router
- **Base de datos:** PostgreSQL (27 tablas, ver `backend/database/schema.sql`)

## Estado del proyecto — Fase 1 completada ✅

| Fase | Contenido | Estado |
|------|-----------|--------|
| **1** | Autenticación, Usuarios/Roles, Asociación Civil | ✅ Implementado |
| **2** | Voluntarios, Expedientes digitales, Gestor de archivos | ✅ Implementado |
| **3** | Actividades, Participación, Horas, Credencial/QR | ✅ Implementado |
| **4** | Dashboard, Reportes, Notificaciones | ✅ Implementado |
| **5** | Auditoría, Bitácora, Configuración, Respaldo, API docs | ✅ Implementado |
| 6 | Firma electrónica, generación de documentos, portales, multi-asociación | ⏳ Pendiente |

## Estructura del repositorio

```
sigevac/
├── backend/
│   ├── database/
│   │   ├── schema.sql          # Esquema completo (27 tablas, todos los módulos)
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
npm run db:setup     # Crea las 27 tablas
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

## Fase 2 — Voluntarios, Expedientes y Gestor de archivos (Módulos 4–9)

- **Registro de voluntarios** con folio automático (`SC-AAAA-0001`), detección de mayoría/minoría de edad y datos de tutor obligatorios para menores (Módulo 6)
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
- **Respaldo** (Módulo 20): genera un dump real de PostgreSQL con `pg_dump` (formato plano), lo registra en la tabla `respaldos` y permite descargarlo — funcionalidad reservada al rol `super_admin`.
- **Documentación de la API** (Módulo 22): especificación OpenAPI 3.0 servida con Swagger UI en `/api/docs`, cubriendo los endpoints de las Fases 1 a 5.
- Frontend: página de Administración con pestañas para Auditoría, Bitácora, Configuración y Respaldos (con descarga directa del dump).

Todo el flujo de esta fase (crear un voluntario y verificar que aparece en auditoría y bitácora automáticamente → establecer y listar configuración → generar un respaldo real con `pg_dump` y descargarlo → verificar que Swagger UI responde → confirmar que un usuario con rol `coordinador` recibe 403 al intentar generar respaldos o ver auditoría) fue probado de extremo a extremo contra PostgreSQL real.

## Roadmap de módulos (23 totales, ver especificación completa)

El esquema de base de datos (`schema.sql`) ya contempla las tablas de **todos** los módulos (voluntarios, tutores, expedientes, documentos, archivos, actividades, participaciones, asistencias, horas de servicio, credenciales, QR, notificaciones, auditoría, bitácora, configuración, respaldos), para que cada fase futura solo agregue modelos/controladores/rutas sin migrar el esquema desde cero.

## Diseño para multi-asociación futura

Aunque el sistema arranca enfocado en una sola asociación (Sueños de Comedia A.C.), las tablas clave (`usuarios`, `voluntarios`, `actividades`, `configuracion`) ya incluyen `asociacion_id` como llave foránea, de modo que activar el modo multi-asociación en el futuro no requiere rediseñar el esquema — solo agregar el selector de asociación en la capa de autenticación/autorización.
