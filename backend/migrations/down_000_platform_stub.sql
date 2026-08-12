-- Rollback for 000_platform_stub.sql
-- Only safe to run if no other module data depends on organizations/users.

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;
