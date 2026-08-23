CREATE TABLE IF NOT EXISTS solicitudes_voluntariado (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(160) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    telefono VARCHAR(30),
    mensaje TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_revision','aprobada','rechazada')),
    revisada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    revisada_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_asociacion_estado ON solicitudes_voluntariado(asociacion_id, estado);
