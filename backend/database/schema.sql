-- ============================================================
-- SIGEVAC - Sistema Integral para la Gestión de Expedientes
-- y Voluntariado para Asociaciones Civiles
-- Esquema de Base de Datos - PostgreSQL
--
-- Soporta multi-asociación: un usuario puede pertenecer a más de
-- una asociación civil (tabla `usuario_asociaciones`, N:M) y la
-- FK `asociacion_id` está presente en las tablas operativas para
-- aislar los datos de cada asociación entre sí.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- MÓDULO 3: ASOCIACIÓN CIVIL
-- ============================================================
CREATE TABLE asociaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL,
    rfc VARCHAR(13),
    logo_url TEXT,
    direccion VARCHAR(300),
    municipio VARCHAR(120),
    estado VARCHAR(120),
    telefono VARCHAR(20),
    correo VARCHAR(150),
    redes_sociales JSONB DEFAULT '{}',
    representante_legal VARCHAR(200),
    acta_constitutiva_url TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configuración de documentos requeridos por asociación (Módulo 3)
CREATE TABLE asociacion_config_documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    tipo_documento_id UUID, -- FK a tipos_documento (definida más abajo)
    obligatorio BOOLEAN NOT NULL DEFAULT true,
    aplica_a VARCHAR(20) NOT NULL DEFAULT 'mayor' -- mayor | menor | ambos
);

-- ============================================================
-- MÓDULO 1 y 2: AUTENTICACIÓN Y USUARIOS/ROLES
-- ============================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL UNIQUE, -- super_admin, presidente, coordinador, capturista, supervisor, consulta
    descripcion VARCHAR(200),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clave VARCHAR(100) NOT NULL UNIQUE, -- e.g. voluntarios.crear, expedientes.aprobar
    modulo VARCHAR(80) NOT NULL,
    descripcion VARCHAR(200)
);

CREATE TABLE roles_permisos (
    rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID REFERENCES asociaciones(id) ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    ultimo_login TIMESTAMPTZ,
    intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ,
    two_factor_secret TEXT,
    two_factor_activo BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuarios_roles (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, rol_id)
);

-- Multi-asociación (evolución del diseño original): un mismo usuario del
-- sistema puede pertenecer a más de una asociación civil. `usuarios.asociacion_id`
-- se conserva por compatibilidad (se usa como respaldo al poblar esta tabla),
-- pero la fuente de verdad para permisos y para elegir la "asociación activa"
-- de una sesión es esta tabla N:M.
CREATE TABLE usuario_asociaciones (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    es_predeterminada BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, asociacion_id)
);
CREATE INDEX idx_usuario_asociaciones_usuario ON usuario_asociaciones(usuario_id);

-- Sesiones activas / refresh tokens (Módulo 1 - seguridad)
CREATE TABLE sesiones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    ip VARCHAR(45),
    user_agent TEXT,
    expira_en TIMESTAMPTZ NOT NULL,
    revocado BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tokens_recuperacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    usado BOOLEAN NOT NULL DEFAULT false,
    expira_en TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO 19: CATÁLOGOS (municipios, estados, catálogos genéricos)
-- ============================================================
CREATE TABLE estados_mx (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE municipios (
    id SERIAL PRIMARY KEY,
    estado_id INTEGER NOT NULL REFERENCES estados_mx(id),
    nombre VARCHAR(120) NOT NULL
);

CREATE TABLE catalogos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(80) NOT NULL, -- p.ej. tipo_sangre, parentesco
    clave VARCHAR(80) NOT NULL,
    etiqueta VARCHAR(150) NOT NULL,
    orden SMALLINT DEFAULT 0,
    UNIQUE (tipo, clave)
);

-- ============================================================
-- MÓDULO 4, 5, 6: VOLUNTARIOS, CLASIFICACIÓN, TUTORES
-- ============================================================
CREATE TABLE voluntarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    numero_voluntario VARCHAR(30) UNIQUE, -- folio para credencial/QR
    fotografia_url TEXT,
    nombre VARCHAR(150) NOT NULL,
    apellido_paterno VARCHAR(100),
    apellido_materno VARCHAR(100),
    curp VARCHAR(18) UNIQUE,
    sexo VARCHAR(20),
    fecha_nacimiento DATE NOT NULL,
    estado_civil VARCHAR(30),
    nacionalidad VARCHAR(60) DEFAULT 'Mexicana',
    correo VARCHAR(150),
    telefono VARCHAR(20),
    direccion VARCHAR(300),
    codigo_postal VARCHAR(10),
    municipio_id INTEGER REFERENCES municipios(id),
    estado_id INTEGER REFERENCES estados_mx(id),
    tipo_sangre VARCHAR(10),
    alergias TEXT,
    contacto_emergencia_nombre VARCHAR(150),
    contacto_emergencia_telefono VARCHAR(20),
    contacto_emergencia_parentesco VARCHAR(60),
    -- Nota: no se usa columna GENERATED con CURRENT_DATE porque Postgres
    -- exige expresiones inmutables en columnas generadas, y CURRENT_DATE
    -- no lo es. Se calcula en la aplicación al crear/actualizar el registro.
    es_menor_edad BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Módulo 5: Clasificación (un voluntario puede tener varias clasificaciones)
CREATE TABLE tipos_voluntario (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(40) NOT NULL UNIQUE, -- mayor_edad, menor_edad, servicio_social, residencia, temporal, permanente, coordinador, instructor
    etiqueta VARCHAR(80) NOT NULL
);

CREATE TABLE voluntarios_tipos (
    voluntario_id UUID NOT NULL REFERENCES voluntarios(id) ON DELETE CASCADE,
    tipo_voluntario_id INTEGER NOT NULL REFERENCES tipos_voluntario(id),
    PRIMARY KEY (voluntario_id, tipo_voluntario_id)
);

-- Módulo 6: Tutor (solo menores)
CREATE TABLE tutores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voluntario_id UUID NOT NULL REFERENCES voluntarios(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    curp VARCHAR(18),
    ine VARCHAR(30),
    telefono VARCHAR(20),
    correo VARCHAR(150),
    parentesco VARCHAR(60),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO 7, 8, 9: EXPEDIENTE DIGITAL, ARCHIVOS, ESTADO
-- ============================================================
CREATE TABLE tipos_documento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clave VARCHAR(60) NOT NULL UNIQUE, -- curp, ine, comprobante_domicilio, seguro, ficha_voluntariado, carta_responsiva, aviso_privacidad, reglamento_interno, uso_imagen, ine_tutor, carta_autorizacion
    etiqueta VARCHAR(150) NOT NULL,
    aplica_a VARCHAR(20) NOT NULL DEFAULT 'ambos', -- mayor | menor | ambos
    tiene_vigencia BOOLEAN NOT NULL DEFAULT false -- p.ej. seguros, identificaciones
);

CREATE TABLE expedientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voluntario_id UUID NOT NULL UNIQUE REFERENCES voluntarios(id) ON DELETE CASCADE,
    estado VARCHAR(20) NOT NULL DEFAULT 'incompleto', -- completo | en_revision | incompleto (semáforo)
    porcentaje_avance SMALLINT NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    tipo_documento_id UUID NOT NULL REFERENCES tipos_documento(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pendiente | cargado | aprobado | rechazado
    vigencia_hasta DATE,
    alerta_vigencia_enviada_en TIMESTAMPTZ, -- Módulo 17 (diferenciador): evita reenviar la misma alerta de vencimiento
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expediente_id, tipo_documento_id)
);

-- Módulo 8: Gestor de archivos (versionado)
CREATE TABLE archivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    nombre_original VARCHAR(255),
    mime_type VARCHAR(100),
    tamano_bytes BIGINT,
    version INTEGER NOT NULL DEFAULT 1,
    subido_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO 10, 11, 12: ACTIVIDADES, PARTICIPACIÓN, HORAS
-- ============================================================
CREATE TABLE actividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME,
    hora_fin TIME,
    estado VARCHAR(20) NOT NULL DEFAULT 'programada',
    lugar VARCHAR(200),
    responsable_id UUID REFERENCES usuarios(id),
    descripcion TEXT,
    cupo INTEGER,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evidencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actividad_id UUID NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    descripcion VARCHAR(255),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE participaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actividad_id UUID NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    voluntario_id UUID NOT NULL REFERENCES voluntarios(id) ON DELETE CASCADE,
    inscrito_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (actividad_id, voluntario_id)
);

CREATE TABLE asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participacion_id UUID NOT NULL REFERENCES participaciones(id) ON DELETE CASCADE,
    hora_entrada TIMESTAMPTZ,
    hora_salida TIMESTAMPTZ,
    horas_realizadas NUMERIC(6,2),
    observaciones TEXT
);

CREATE TABLE horas_servicio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voluntario_id UUID NOT NULL REFERENCES voluntarios(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL, -- servicio_social | residencia | voluntariado
    periodo VARCHAR(20) NOT NULL, -- e.g. 2026-1
    horas_acumuladas NUMERIC(8,2) NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (voluntario_id, tipo, periodo)
);

-- ============================================================
-- MÓDULO 13, 14: CREDENCIAL DIGITAL Y QR
-- ============================================================
CREATE TABLE credenciales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voluntario_id UUID NOT NULL UNIQUE REFERENCES voluntarios(id) ON DELETE CASCADE,
    vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta DATE NOT NULL,
    url_pdf TEXT,
    activa BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE qr_codigos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voluntario_id UUID NOT NULL UNIQUE REFERENCES voluntarios(id) ON DELETE CASCADE,
    codigo VARCHAR(100) NOT NULL UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO 17: NOTIFICACIONES
-- ============================================================
CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    voluntario_id UUID REFERENCES voluntarios(id) ON DELETE CASCADE,
    tipo VARCHAR(60) NOT NULL, -- documento_faltante | expediente_aprobado | documento_rechazado | nueva_actividad
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT,
    leida BOOLEAN NOT NULL DEFAULT false,
    enviada_por_correo BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO 18, 21: AUDITORÍA Y BITÁCORA
-- ============================================================
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    modulo_afectado VARCHAR(80),
    entidad_id UUID,
    detalle JSONB,
    ip VARCHAR(45),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bitacora (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    evento VARCHAR(150) NOT NULL,
    contexto JSONB,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO 19: CONFIGURACIÓN GENERAL
-- ============================================================
CREATE TABLE configuracion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID REFERENCES asociaciones(id) ON DELETE CASCADE,
    clave VARCHAR(100) NOT NULL,
    valor JSONB,
    UNIQUE (asociacion_id, clave)
);

-- ============================================================
-- MÓDULO 20: RESPALDOS
-- ============================================================
CREATE TABLE respaldos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    archivo_url TEXT NOT NULL,
    tamano_bytes BIGINT,
    generado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FASE 6 (diferenciador): FIRMA ELECTRÓNICA SIMPLE
-- Firma capturada en el navegador (trazo sobre <canvas>), guardada como
-- imagen PNG en base64. Aplica solo a los "formatos internos" —cartas,
-- avisos y reglamentos— no a identificaciones oficiales.
-- ============================================================
CREATE TABLE firmas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    firmante_nombre VARCHAR(150) NOT NULL,
    firmante_tipo VARCHAR(20) NOT NULL DEFAULT 'voluntario', -- voluntario | tutor
    imagen_png_base64 TEXT NOT NULL,
    ip VARCHAR(45),
    user_agent TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_voluntarios_asociacion ON voluntarios(asociacion_id);
CREATE INDEX idx_voluntarios_curp ON voluntarios(curp);
CREATE INDEX idx_expedientes_estado ON expedientes(estado);
CREATE INDEX idx_documentos_expediente ON documentos(expediente_id);
CREATE INDEX idx_participaciones_voluntario ON participaciones(voluntario_id);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_creado_en ON auditoria(creado_en);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, leida);
CREATE INDEX idx_usuarios_correo ON usuarios(correo);
CREATE INDEX idx_firmas_documento ON firmas(documento_id);
