-- MFA support for admin accounts (TOTP)
ALTER TABLE app_users ADD COLUMN mfa_secret   VARCHAR(64);
ALTER TABLE app_users ADD COLUMN mfa_enabled  BOOLEAN NOT NULL DEFAULT false;
