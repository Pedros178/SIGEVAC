-- ============================================================
-- Migración 016 — Galería pública administrable.
--
-- Antes, la sección "Galería" del Home público mostraba un arreglo de
-- fotos fijo en el código del frontend. Esta migración agrega una tabla
-- para que la Administración pueda subir, ocultar y quitar fotos/carteles
-- desde el panel, sin tocar código.
--
-- Uso: solo necesaria si ya tienes una base de datos SIGEVAC creada
-- ANTES de este cambio. Si vas a correr `npm run db:setup` sobre una
-- base de datos nueva, este archivo NO es necesario: schema.sql ya
-- incluye estos cambios desde el inicio.
--
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================

CREATE TABLE IF NOT EXISTS galeria_publica (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    mime_type VARCHAR(60) NOT NULL DEFAULT 'image/jpeg',
    texto_alternativo VARCHAR(200) NOT NULL,
    leyenda VARCHAR(120) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    publicada BOOLEAN NOT NULL DEFAULT true,
    subida_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_galeria_asociacion_orden ON galeria_publica(asociacion_id, orden);

INSERT INTO permisos (clave, modulo, descripcion) VALUES
    ('galeria.consultar', 'galeria', 'Ver las fotos de la galería pública, incluidas las ocultas'),
    ('galeria.gestionar', 'galeria', 'Subir, editar, ocultar y eliminar fotos de la galería pública')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'super_admin' AND p.clave IN ('galeria.consultar', 'galeria.gestionar')
ON CONFLICT DO NOTHING;

-- presidente ya recibe todo lo que no esté explícitamente excluido en su
-- INSERT original (ver seeds/001_seed_base.sql), pero como esos permisos
-- no existían cuando ese INSERT corrió, hay que agregarlos aquí también.
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'presidente' AND p.clave IN ('galeria.consultar', 'galeria.gestionar')
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'coordinador' AND p.clave IN ('galeria.consultar', 'galeria.gestionar')
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre IN ('supervisor', 'consulta') AND p.clave = 'galeria.consultar'
ON CONFLICT DO NOTHING;
