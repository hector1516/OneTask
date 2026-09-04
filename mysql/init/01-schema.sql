-- OneTask schema (MySQL 8). Also enforced idempotently by the API on boot.
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  owner_user_id CHAR(36) NULL,
  last_heartbeat TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_devices_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS modules (
  id VARCHAR(128) NOT NULL,
  version VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  entry VARCHAR(255) NOT NULL DEFAULT 'bundle.js',
  min_core_version VARCHAR(32) NOT NULL DEFAULT '0.1.0',
  permissions JSON NOT NULL,
  config_schema JSON NOT NULL,
  hash VARCHAR(128) NOT NULL,
  signature VARCHAR(256) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- DEC-007 queue. Exact column names required by the spec.
CREATE TABLE IF NOT EXISTS module_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deviceId VARCHAR(128) NOT NULL,
  moduleId VARCHAR(128) NOT NULL,
  version VARCHAR(32) NOT NULL DEFAULT 'latest',
  params JSON NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  status ENUM('pending','running','done','failed') NOT NULL DEFAULT 'pending',
  queuedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  startedAt TIMESTAMP NULL DEFAULT NULL,
  finishedAt TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_queue_device_status (deviceId, status),
  INDEX idx_queue_device_queued (deviceId, queuedAt),
  CONSTRAINT fk_queue_device FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS module_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(128) NOT NULL,
  module_id VARCHAR(128) NOT NULL DEFAULT '',
  module_name VARCHAR(255) NOT NULL DEFAULT '',
  module_description TEXT NOT NULL,
  module_version VARCHAR(32) NOT NULL DEFAULT '',
  queue_total INT NOT NULL DEFAULT 0,
  queue_pending INT NOT NULL DEFAULT 0,
  queue_running INT NOT NULL DEFAULT 0,
  queue_done INT NOT NULL DEFAULT 0,
  exec_status VARCHAR(32) NOT NULL DEFAULT '',
  exec_queued_at TIMESTAMP NULL DEFAULT NULL,
  exec_started_at TIMESTAMP NULL DEFAULT NULL,
  exec_finished_at TIMESTAMP NULL DEFAULT NULL,
  reported_at TIMESTAMP NULL DEFAULT NULL,
  raw JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_results_device_created (device_id, created_at),
  CONSTRAINT fk_results_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token VARCHAR(512) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
