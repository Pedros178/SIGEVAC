-- ============================================================
-- Endurecimiento de seguridad (auditoría)
--  * 2FA: anti-replay del código TOTP (último paso de 30 s usado).
--  * Sesiones: marca de rotación del refresh token (detección de reuso).
--  * CURP única POR ASOCIACIÓN (antes era única global: una persona que
--    colabora en dos asociaciones no podía registrarse en la segunda, y
--    el 409 revelaba que la CURP existe en otra asociación).
--  * Rol 'consulta' ya no ve la auditoría (contiene datos de operaciones
--    de administración).
-- Idempotente: se puede aplicar más de una vez sin efecto adicional.
-- ============================================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS two_factor_ultimo_paso BIGINT;
ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS rotado_en TIMESTAMPTZ;

ALTER TABLE voluntarios DROP CONSTRAINT IF EXISTS voluntarios_curp_key;
DROP INDEX IF EXISTS idx_voluntarios_curp;
CREATE UNIQUE INDEX IF NOT EXISTS voluntarios_asociacion_curp_unica_idx
    ON voluntarios (asociacion_id, curp) WHERE curp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voluntarios_curp ON voluntarios (curp);

CREATE INDEX IF NOT EXISTS idx_usuario_asociaciones_asociacion ON usuario_asociaciones (asociacion_id);

DELETE FROM roles_permisos
WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'consulta')
  AND permiso_id = (SELECT id FROM permisos WHERE clave = 'auditoria.consultar');

-- Catálogo de estados de la República precargado (antes solo existía
-- 'Puebla' y el resto se creaba al vuelo desde texto libre, con riesgo de
-- duplicados como "Oaxaca"/"oaxaca " o basura escrita por cualquier capturista).
INSERT INTO estados_mx (nombre) VALUES
 ('Aguascalientes'),('Baja California'),('Baja California Sur'),('Campeche'),('Chiapas'),
 ('Chihuahua'),('Ciudad de México'),('Coahuila'),('Colima'),('Durango'),('Guanajuato'),
 ('Guerrero'),('Hidalgo'),('Jalisco'),('México'),('Michoacán'),('Morelos'),('Nayarit'),
 ('Nuevo León'),('Oaxaca'),('Puebla'),('Querétaro'),('Quintana Roo'),('San Luis Potosí'),
 ('Sinaloa'),('Sonora'),('Tabasco'),('Tamaulipas'),('Tlaxcala'),('Veracruz'),('Yucatán'),('Zacatecas')
ON CONFLICT (nombre) DO NOTHING;
