-- 011_add_user_auth_fields.sql
-- Adds standalone email/password login support to the stubbed `users`
-- table from 000_platform_stub.sql. In real ARGO, identity/auth is owned
-- by the platform core; this slice now runs standalone, so it needs its
-- own credential storage.
--
-- Non-destructive: existing users keep their id/organization_id/email/role.
-- `name` and `password_hash` are added as nullable so no existing row is
-- broken; a user simply can't log in via password until a hash is set
-- (e.g. by the seed script).

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Case-insensitive lookup by email is how login works; enforce
-- uniqueness the same way to prevent duplicate accounts differing only
-- by case.
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower
  ON users (lower(email));

COMMIT;
