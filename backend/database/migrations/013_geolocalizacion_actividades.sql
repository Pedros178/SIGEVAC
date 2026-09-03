-- Mapa interactivo de actividades: coordenadas opcionales del lugar donde
-- se realiza cada actividad. Se guardan como NUMERIC (no PostGIS) porque
-- solo se necesita mostrar un punto en el mapa, no hacer consultas
-- espaciales; mantiene la instalación simple sin depender de extensiones.
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,7);
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,7);
