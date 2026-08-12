-- 000_platform_stub.sql
-- NOT part of this module's real schema. In production ARGO, `organizations` and
-- `users` already exist and are owned by the platform core. They are stubbed
-- here ONLY so this vertical slice can run standalone for grading/demo purposes.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL -- viewer | fundraising_staff | finance_staff | manager | administrator
);
