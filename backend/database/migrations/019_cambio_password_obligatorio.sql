-- Cambio obligatorio de contraseña: la cuenta de administrador creada por el seed con
-- una contraseña GENERADA debe cambiarla en el primer inicio de sesión. Mientras la
-- marca esté activa, la API solo permite cambiar la contraseña, ver el perfil,
-- renovar la sesión y cerrar sesión.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT false;
