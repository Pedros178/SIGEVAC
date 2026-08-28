-- Bug real encontrado en revisión de frontend: las evidencias fotográficas
-- de actividades se podían subir, pero nunca se podían volver a ver —
-- no existía ningún endpoint para servir su contenido de vuelta, y la
-- tabla ni siquiera guardaba el mime_type necesario para hacerlo bien.
ALTER TABLE evidencias ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
