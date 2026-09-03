-- ============================================================
-- Migración 001 — Multi-asociación (N:M) y alertas de vigencia
--
-- Uso: solo necesaria si ya tienes una base de datos SIGEVAC creada
-- ANTES de este cambio. Si vas a correr `npm run db:setup` sobre una
-- base de datos nueva, este archivo NO es necesario: schema.sql ya
-- incluye estos cambios desde el inicio.
--
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================

CREATE TABLE IF NOT EXISTS usuario_asociaciones (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    es_predeterminada BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, asociacion_id)
);
CREATE INDEX IF NOT EXISTS idx_usuario_asociaciones_usuario ON usuario_asociaciones(usuario_id);

-- Backfill: cada usuario que ya tenía una asociacion_id directa pasa a
-- tenerla también en la tabla N:M, marcada como predeterminada.
INSERT INTO usuario_asociaciones (usuario_id, asociacion_id, es_predeterminada)
SELECT id, asociacion_id, true
FROM usuarios
WHERE asociacion_id IS NOT NULL
ON CONFLICT (usuario_id, asociacion_id) DO NOTHING;

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS alerta_vigencia_enviada_en TIMESTAMPTZ;
