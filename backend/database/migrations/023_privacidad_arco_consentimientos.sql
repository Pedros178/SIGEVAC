-- Fase 13: privacidad y protección de datos personales (LFPDPPP).
--  1. Registro de consentimientos / aceptación del aviso de privacidad.
--  2. Solicitudes de derechos ARCO (Acceso, Rectificación, Cancelación, Oposición).
--  3. Marca de anonimización de voluntarios (derecho de cancelación).
--  4. Permiso `privacidad.gestionar` para atender estos derechos.

CREATE TABLE IF NOT EXISTS consentimientos_privacidad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    voluntario_id UUID NOT NULL REFERENCES voluntarios(id) ON DELETE CASCADE,
    version_aviso VARCHAR(30) NOT NULL,
    -- Finalidades que NO son necesarias para el servicio (p. ej. uso de imagen en difusión)
    finalidades_secundarias BOOLEAN NOT NULL DEFAULT false,
    medio VARCHAR(30) NOT NULL DEFAULT 'presencial' CHECK (medio IN ('presencial', 'portal', 'documento_firmado', 'otro')),
    registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    revocado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consentimientos_voluntario ON consentimientos_privacidad (voluntario_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS solicitudes_arco (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    voluntario_id UUID REFERENCES voluntarios(id) ON DELETE SET NULL,
    tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('acceso', 'rectificacion', 'cancelacion', 'oposicion')),
    detalle TEXT,
    estado VARCHAR(15) NOT NULL DEFAULT 'recibida' CHECK (estado IN ('recibida', 'en_proceso', 'atendida', 'rechazada')),
    -- La ley da 20 días hábiles para responder; aquí se guarda una fecha límite de 30 días naturales (aprox.) como alerta.
    fecha_limite DATE NOT NULL DEFAULT (CURRENT_DATE + 28),
    resolucion TEXT,
    atendida_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    atendida_en TIMESTAMPTZ,
    registrada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_arco_asociacion ON solicitudes_arco (asociacion_id, estado, creado_en DESC);

ALTER TABLE voluntarios ADD COLUMN IF NOT EXISTS anonimizado_en TIMESTAMPTZ;

-- Quien llena el formulario público debe aceptar el aviso de privacidad; se deja constancia.
ALTER TABLE solicitudes_voluntariado ADD COLUMN IF NOT EXISTS version_aviso VARCHAR(30);
ALTER TABLE solicitudes_voluntariado ADD COLUMN IF NOT EXISTS aviso_aceptado_en TIMESTAMPTZ;

INSERT INTO permisos (clave, modulo, descripcion) VALUES
    ('privacidad.gestionar', 'privacidad', 'Atender derechos ARCO: exportar datos personales, registrar consentimientos y anonimizar voluntarios')
ON CONFLICT (clave) DO NOTHING;

-- Instalaciones existentes: se asigna a los roles de mayor jerarquía (en una base nueva lo hace el seed).
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE p.clave = 'privacidad.gestionar' AND r.nombre IN ('super_admin', 'presidente')
ON CONFLICT DO NOTHING;
