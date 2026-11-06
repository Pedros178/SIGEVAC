-- Fase 13: datos de salud cifrados en reposo (AES-256-GCM a nivel de aplicación).
-- El texto cifrado (prefijo + IV + etiqueta + base64) es bastante más largo que el valor
-- original, así que las columnas VARCHAR(10)/VARCHAR(200) deben pasar a TEXT. La longitud
-- máxima del dato en claro se sigue validando en la API (utils/validarVoluntario.js).
-- Los datos ya existentes se cifran con: npm run db:encrypt-existing
ALTER TABLE voluntarios ALTER COLUMN tipo_sangre TYPE TEXT;
ALTER TABLE voluntarios ALTER COLUMN alergias TYPE TEXT;
ALTER TABLE voluntarios ALTER COLUMN discapacidad TYPE TEXT;
ALTER TABLE voluntarios ALTER COLUMN enfermedad_cronica TYPE TEXT;
