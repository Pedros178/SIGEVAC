-- Consolidate the duplicate seed/application record before enforcing uniqueness.
BEGIN;

DO $$
DECLARE
  asociacion_original UUID := '8c738241-cb19-41dd-9c10-7cbe34004e4c';
  asociacion_duplicada UUID := '03d4e46a-8026-4291-b4a3-6dd6e0fff9c9';
  referencia RECORD;
BEGIN
  FOR referencia IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE column_name = 'asociacion_id'
      AND table_schema = 'public'
      AND table_name <> 'asociaciones'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
      referencia.table_schema, referencia.table_name, referencia.column_name, referencia.column_name
    ) USING asociacion_original, asociacion_duplicada;
  END LOOP;

  UPDATE asociaciones
  SET municipio = 'Huamantla', estado = 'Tlaxcala', actualizado_en = now()
  WHERE id = asociacion_original;

  DELETE FROM asociaciones WHERE id = asociacion_duplicada;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS asociaciones_nombre_unico_idx
  ON asociaciones (lower(trim(nombre)));

COMMIT;