-- 02-seed.sql is intentionally minimal: the API seeds the admin user,
-- demo device and the system-monitor module on boot (idempotent).
-- This file only guarantees the demo device row exists for fresh MySQL
-- volumes started without the API (e.g. inspecting via phpMyAdmin).
INSERT IGNORE INTO devices (id, name) VALUES ('agent-dev-01', 'Dev Agent (Tauri)');
