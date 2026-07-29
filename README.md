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
| 3 | Actividades, Participación, Horas, Credencial/QR | ⏳ Pendiente |
| 4 | Dashboard, Reportes, Notificaciones | ⏳ Pendiente |
| 5 | Auditoría, Bitácora, Configuración, Respaldo, API docs | ⏳ Pendiente |
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

## Roadmap de módulos (23 totales, ver especificación completa)

El esquema de base de datos (`schema.sql`) ya contempla las tablas de **todos** los módulos (voluntarios, tutores, expedientes, documentos, archivos, actividades, participaciones, asistencias, horas de servicio, credenciales, QR, notificaciones, auditoría, bitácora, configuración, respaldos), para que cada fase futura solo agregue modelos/controladores/rutas sin migrar el esquema desde cero.

## Diseño para multi-asociación futura

Aunque el sistema arranca enfocado en una sola asociación (Sueños de Comedia A.C.), las tablas clave (`usuarios`, `voluntarios`, `actividades`, `configuracion`) ya incluyen `asociacion_id` como llave foránea, de modo que activar el modo multi-asociación en el futuro no requiere rediseñar el esquema — solo agregar el selector de asociación en la capa de autenticación/autorización.
