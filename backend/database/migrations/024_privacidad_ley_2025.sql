-- Fase 14: ajustes a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (DOF 20-mar-2025).
--  * Art. 8: los datos sensibles (salud) exigen consentimiento EXPRESO Y POR ESCRITO (firma autógrafa, firma
--    electrónica o mecanismo de autenticación): se registra por tipo y quién lo otorgó (titular o tutor).
--  * Art. 31: la respuesta a solicitudes ARCO es en 20 días HÁBILES, la ejecución en otros 15 hábiles, y ambos
--    plazos se pueden ampliar UNA sola vez por un periodo igual.
--  * Art. 24: tras cancelar, se debe dar aviso a la persona titular.

ALTER TABLE consentimientos_privacidad
    ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) NOT NULL DEFAULT 'aviso'
        CHECK (tipo IN ('aviso', 'datos_sensibles', 'finalidades_secundarias', 'transferencias')),
    ADD COLUMN IF NOT EXISTS otorgado_por VARCHAR(10) NOT NULL DEFAULT 'titular'
        CHECK (otorgado_por IN ('titular', 'tutor'));

ALTER TABLE consentimientos_privacidad DROP CONSTRAINT IF EXISTS consentimientos_privacidad_medio_check;
ALTER TABLE consentimientos_privacidad ADD CONSTRAINT consentimientos_privacidad_medio_check
    CHECK (medio IN ('presencial', 'portal', 'documento_firmado', 'firma_electronica', 'otro'));

CREATE INDEX IF NOT EXISTS idx_consentimientos_tipo ON consentimientos_privacidad (voluntario_id, tipo) WHERE revocado_en IS NULL;

ALTER TABLE solicitudes_arco
    ADD COLUMN IF NOT EXISTS ampliada BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_limite_ejecucion DATE,
    ADD COLUMN IF NOT EXISTS titular_notificado_en TIMESTAMPTZ;
