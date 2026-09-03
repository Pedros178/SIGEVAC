-- ============================================================
-- Índices de seguridad/rendimiento faltantes
--
-- sesiones.refresh_token_hash y tokens_recuperacion.token_hash se
-- consultan en CADA login, refresh y reseteo de contraseña
-- (SesionModel.buscarPorHash / TokenRecuperacionModel.buscarValido).
-- Sin índice, cada una de esas peticiones hace un full table scan;
-- funciona en desarrollo (tablas chicas) pero degrada notablemente
-- en producción conforme crecen las sesiones históricas.
--
-- actividades.asociacion_id se usa en el middleware de aislamiento
-- (middlewares/aislamiento.js -> actividadDeAsociacion) en cada
-- petición sobre una actividad específica, y no tenía índice.
--
-- bitacora.creado_en se usa para el job de retención (ver
-- utils/retencionBitacora.js) y para cualquier consulta de
-- auditoría por rango de fechas en el panel de administración.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sesiones_refresh_token_hash
    ON sesiones(refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario
    ON sesiones(usuario_id);

CREATE INDEX IF NOT EXISTS idx_tokens_recuperacion_token_hash
    ON tokens_recuperacion(token_hash);

CREATE INDEX IF NOT EXISTS idx_actividades_asociacion
    ON actividades(asociacion_id);

CREATE INDEX IF NOT EXISTS idx_bitacora_creado_en
    ON bitacora(creado_en);

CREATE INDEX IF NOT EXISTS idx_bitacora_usuario
    ON bitacora(usuario_id);
