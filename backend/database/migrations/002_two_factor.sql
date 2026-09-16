-- 2FA TOTP compatible con Google Authenticator y Microsoft Authenticator.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS two_factor_activo BOOLEAN NOT NULL DEFAULT false;
