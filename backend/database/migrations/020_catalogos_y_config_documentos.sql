-- ============================================================
-- Migración 020 — Conecta dos tablas que existían pero no se usaban.
--
-- 1) `catalogos` (listas genéricas: tipo de sangre, parentesco) ya se
--    creaba y se sembraba, pero ningún código la leía. Ahora la expone
--    GET /api/catalogos/:tipo y se administra desde el panel
--    (Administración → Catálogos).
--
-- 2) `asociacion_config_documentos` (Módulo 3: documentos requeridos
--    por asociación) tampoco tenía uso. Ahora define, por asociación,
--    qué tipos de documento se exigen y a quién (mayor/menor/ambos) al
--    generar el expediente de un voluntario nuevo. Esta migración le
--    agrega las restricciones que le faltaban: FK real a
--    `tipos_documento`, unicidad por (asociación, tipo) y validación de
--    `aplica_a`.
--
-- Es idempotente: se puede ejecutar más de una vez sin error, y también
-- después de schema.sql (que ya trae estas restricciones).
-- ============================================================

-- Datos semilla de catálogos (por si la base se creó antes de que existieran)
INSERT INTO catalogos (tipo, clave, etiqueta, orden) VALUES
    ('tipo_sangre', 'o_positivo',  'O+',  1),
    ('tipo_sangre', 'o_negativo',  'O-',  2),
    ('tipo_sangre', 'a_positivo',  'A+',  3),
    ('tipo_sangre', 'a_negativo',  'A-',  4),
    ('tipo_sangre', 'b_positivo',  'B+',  5),
    ('tipo_sangre', 'b_negativo',  'B-',  6),
    ('tipo_sangre', 'ab_positivo', 'AB+', 7),
    ('tipo_sangre', 'ab_negativo', 'AB-', 8),
    ('parentesco', 'madre',   'Madre', 1),
    ('parentesco', 'padre',   'Padre', 2),
    ('parentesco', 'tutor',   'Tutor legal', 3),
    ('parentesco', 'abuelo',  'Abuelo/a', 4),
    ('parentesco', 'hermano', 'Hermano/a mayor de edad', 5)
ON CONFLICT (tipo, clave) DO NOTHING;

-- Limpieza defensiva: filas huérfanas o duplicadas (la tabla nunca se usó,
-- pero si alguien insertó a mano, estas restricciones no deben fallar).
DELETE FROM asociacion_config_documentos WHERE tipo_documento_id IS NULL;
DELETE FROM asociacion_config_documentos WHERE tipo_documento_id NOT IN (SELECT id FROM tipos_documento);
DELETE FROM asociacion_config_documentos a USING asociacion_config_documentos b
WHERE a.asociacion_id = b.asociacion_id AND a.tipo_documento_id = b.tipo_documento_id AND a.ctid > b.ctid;
UPDATE asociacion_config_documentos SET aplica_a = 'ambos' WHERE aplica_a NOT IN ('mayor', 'menor', 'ambos');

ALTER TABLE asociacion_config_documentos ALTER COLUMN tipo_documento_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_docs_tipo_documento') THEN
        ALTER TABLE asociacion_config_documentos
            ADD CONSTRAINT fk_config_docs_tipo_documento
            FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_config_docs_asociacion_tipo') THEN
        ALTER TABLE asociacion_config_documentos
            ADD CONSTRAINT uq_config_docs_asociacion_tipo UNIQUE (asociacion_id, tipo_documento_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_config_docs_aplica_a') THEN
        ALTER TABLE asociacion_config_documentos
            ADD CONSTRAINT chk_config_docs_aplica_a CHECK (aplica_a IN ('mayor', 'menor', 'ambos'));
    END IF;
END $$;
