ALTER TABLE voluntarios
  ADD COLUMN IF NOT EXISTS numero_control VARCHAR(40),
  ADD COLUMN IF NOT EXISTS telefono_fijo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS telefono_celular VARCHAR(20),
  ADD COLUMN IF NOT EXISTS colonia VARCHAR(150),
  ADD COLUMN IF NOT EXISTS discapacidad VARCHAR(200),
  ADD COLUMN IF NOT EXISTS enfermedad_cronica VARCHAR(200),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_domicilio VARCHAR(300),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_colonia VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_municipio VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_estado VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono_fijo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono_celular VARCHAR(20),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_correo VARCHAR(150);