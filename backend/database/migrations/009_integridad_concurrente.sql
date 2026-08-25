BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS asistencias_participacion_unica_idx
  ON asistencias (participacion_id);

CREATE UNIQUE INDEX IF NOT EXISTS archivos_documento_version_unica_idx
  ON archivos (documento_id, version);

COMMIT;