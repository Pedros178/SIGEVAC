-- NOTA: estas tablas ya están incluidas en schema.sql (una instalación
-- nueva con `npm run db:setup` no necesita este archivo). Solo aplícalo
-- si ya tenías una base de datos SIGEVAC creada ANTES de que se agregaran
-- Inventario y Cuotas. Es idempotente (usa IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS inventario_articulos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(160) NOT NULL,
    descripcion TEXT,
    unidad VARCHAR(30) NOT NULL DEFAULT 'pieza',
    existencias INTEGER NOT NULL DEFAULT 0 CHECK (existencias >= 0),
    minimo INTEGER NOT NULL DEFAULT 0 CHECK (minimo >= 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventario_asociacion ON inventario_articulos(asociacion_id);

CREATE TABLE IF NOT EXISTS inventario_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    articulo_id UUID NOT NULL REFERENCES inventario_articulos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    motivo VARCHAR(240),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cuotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asociacion_id UUID NOT NULL REFERENCES asociaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(160) NOT NULL,
    monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    periodo VARCHAR(30) NOT NULL,
    fecha_vencimiento DATE,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cuotas_asociacion ON cuotas(asociacion_id);

CREATE TABLE IF NOT EXISTS pagos_cuotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuota_id UUID NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
    voluntario_id UUID NOT NULL REFERENCES voluntarios(id) ON DELETE CASCADE,
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    metodo VARCHAR(30) NOT NULL DEFAULT 'efectivo',
    referencia VARCHAR(120),
    pagado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL
);
