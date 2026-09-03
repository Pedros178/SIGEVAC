-- ============================================================
-- Migración 015 — Inventario avanzado: categorías/subcategorías,
-- fotos, préstamos formales y mantenimientos.
--
-- Uso: solo necesaria si ya tienes una base de datos SIGEVAC creada
-- ANTES de este cambio. Si vas a correr `npm run db:setup` sobre una
-- base de datos nueva, este archivo NO es necesario: schema.sql ya
-- incluye estos cambios desde el inicio.
--
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================

CREATE TABLE IF NOT EXISTS inventario_categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    categoria_padre_id UUID REFERENCES inventario_categorias(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (asociacion_id, categoria_padre_id, nombre)
);

ALTER TABLE inventario_articulos ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES inventario_categorias(id) ON DELETE SET NULL;
ALTER TABLE inventario_articulos ADD COLUMN IF NOT EXISTS subcategoria_id UUID REFERENCES inventario_categorias(id) ON DELETE SET NULL;
ALTER TABLE inventario_articulos ADD COLUMN IF NOT EXISTS estado_fisico VARCHAR(20) NOT NULL DEFAULT 'bueno';
ALTER TABLE inventario_articulos ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(160);
ALTER TABLE inventario_articulos ADD COLUMN IF NOT EXISTS codigo_qr VARCHAR(60);
ALTER TABLE inventario_articulos ADD COLUMN IF NOT EXISTS sku VARCHAR(60);
-- Distingue consumibles (solo existencias/movimientos) de artículos
-- prestables (además habilitan el flujo de préstamo/devolución).
ALTER TABLE inventario_articulos ADD COLUMN IF NOT EXISTS es_prestable BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventario_articulos_estado_fisico_check'
    ) THEN
        ALTER TABLE inventario_articulos
            ADD CONSTRAINT inventario_articulos_estado_fisico_check
            CHECK (estado_fisico IN ('bueno','regular','dañado','baja'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventario_articulos_codigo_qr_key'
    ) THEN
        ALTER TABLE inventario_articulos ADD CONSTRAINT inventario_articulos_codigo_qr_key UNIQUE (codigo_qr);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventario_articulos_sku_key'
    ) THEN
        ALTER TABLE inventario_articulos ADD CONSTRAINT inventario_articulos_sku_key UNIQUE (sku);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS inventario_articulo_fotos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    articulo_id UUID NOT NULL REFERENCES inventario_articulos(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    nombre_original VARCHAR(255),
    mime_type VARCHAR(100),
    es_principal BOOLEAN NOT NULL DEFAULT false,
    subido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventario_prestamos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    articulo_id UUID NOT NULL REFERENCES inventario_articulos(id) ON DELETE CASCADE,
    voluntario_id UUID REFERENCES voluntarios(id) ON DELETE SET NULL,
    actividad_id UUID REFERENCES actividades(id) ON DELETE SET NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    responsable VARCHAR(160) NOT NULL,
    contacto VARCHAR(120),
    motivo VARCHAR(240),
    fecha_prestamo TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_devolucion_programada DATE NOT NULL,
    fecha_devolucion_real TIMESTAMPTZ,
    condicion_entrega TEXT,
    condicion_retorno TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'prestado' CHECK (estado IN ('prestado', 'devuelto')),
    registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inventario_prestamos ADD COLUMN IF NOT EXISTS voluntario_id UUID REFERENCES voluntarios(id) ON DELETE SET NULL;
ALTER TABLE inventario_prestamos ADD COLUMN IF NOT EXISTS actividad_id UUID REFERENCES actividades(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS inventario_mantenimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    articulo_id UUID NOT NULL REFERENCES inventario_articulos(id) ON DELETE CASCADE,
    tipo VARCHAR(60) NOT NULL,
    descripcion TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    responsable VARCHAR(160),
    costo NUMERIC(10,2),
    registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventario_articulos_categoria ON inventario_articulos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_inventario_articulos_subcategoria ON inventario_articulos(subcategoria_id);
CREATE INDEX IF NOT EXISTS idx_inventario_categorias_asociacion ON inventario_categorias(asociacion_id);
CREATE INDEX IF NOT EXISTS idx_inventario_categorias_padre ON inventario_categorias(categoria_padre_id);
CREATE INDEX IF NOT EXISTS idx_inventario_fotos_articulo ON inventario_articulo_fotos(articulo_id);
CREATE INDEX IF NOT EXISTS idx_inventario_prestamos_asociacion ON inventario_prestamos(asociacion_id);
CREATE INDEX IF NOT EXISTS idx_inventario_prestamos_articulo ON inventario_prestamos(articulo_id);
CREATE INDEX IF NOT EXISTS idx_inventario_prestamos_estado ON inventario_prestamos(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_prestamos_actividad ON inventario_prestamos(actividad_id);
CREATE INDEX IF NOT EXISTS idx_inventario_prestamos_voluntario ON inventario_prestamos(voluntario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_mantenimientos_articulo ON inventario_mantenimientos(articulo_id);

-- Permisos granulares del módulo (antes solo estaba restringido a super_admin
-- vía requiereRol; ahora usa requierePermiso como el resto de módulos).
INSERT INTO permisos (clave, modulo, descripcion) VALUES
    ('inventario.consultar', 'inventario', 'Ver artículos, categorías, préstamos y mantenimientos del inventario'),
    ('inventario.gestionar', 'inventario', 'Crear/editar artículos, categorías, movimientos, préstamos y mantenimientos del inventario')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'super_admin' AND p.clave IN ('inventario.consultar', 'inventario.gestionar')
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre IN ('presidente', 'coordinador') AND p.clave IN ('inventario.consultar', 'inventario.gestionar')
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre IN ('capturista', 'supervisor', 'consulta') AND p.clave = 'inventario.consultar'
ON CONFLICT DO NOTHING;
