import type { Database } from "better-sqlite3"

export interface StorageCredentials {
  type: "s3" | "b2" | "storj"
  accessKeyId?: string
  secretAccessKey?: string
  applicationKeyId?: string
  applicationKey?: string
  accessKey?: string
  secretKey?: string
  bucket: string
  region?: string
  endpoint?: string
}

export interface S3Credentials extends StorageCredentials {
  type: "s3";
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  endpoint?: string;
}

export interface B2Credentials extends StorageCredentials {
  type: "b2";
  applicationKeyId: string;
  applicationKey: string;
  bucket: string;
}

export interface StorjCredentials extends StorageCredentials {
  type: "storj";
  accessKey: string;
  secretKey: string;
  bucket: string;
  endpoint?: string;
}

export type StorageProviderCredentials = S3Credentials | B2Credentials | StorjCredentials;

export interface StorageProvider {
  id: string;
  name: string;
  type: "s3" | "b2" | "storj";
  config: string; // JSON stringified StorageProviderCredentials
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BackupJob {
  id: string;
  name: string;
  source_path: string;
  storage_provider_id: string;
  schedule: string;
  remote_path: string;
  status: "active" | "paused" | "failed" | "in_progress";
  next_run: string | null;
  last_run: string | null;
  notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface BackupHistory {
  id: string;
  job_id: string;
  status: "success" | "failed";
  start_time: string;
  end_time: string | null;
  duration: number | null;
  size: number | null;
  compression_ratio: number | null;
  message: string | null;
  created_at: string;
}

export interface SMTPConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  id: string;
  email: string;
  on_success: boolean;
  on_failure: boolean;
  on_quota_warning: boolean;
  quota_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  data_directory: string;
  backup_directory: string;
  max_concurrent_jobs: number;
  retention_period: number;
  compression_level: number;
  enable_logging: boolean;
  log_level: string;
  auto_update_check: boolean;
  created_at: string;
  updated_at: string;
}

export const schema = `
-- Storage Providers
CREATE TABLE IF NOT EXISTS storage_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backup Jobs
CREATE TABLE IF NOT EXISTS backup_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_path TEXT NOT NULL,
  schedule TEXT NOT NULL,
  storage_provider_id TEXT NOT NULL,
  remote_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  next_run DATETIME,
  last_run DATETIME,
  notifications BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (storage_provider_id) REFERENCES storage_providers (id)
    ON DELETE CASCADE
);

-- Backup History
CREATE TABLE IF NOT EXISTS backup_history (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration INTEGER,
  size INTEGER,
  compression_ratio REAL,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES backup_jobs (id)
    ON DELETE CASCADE
);

-- SMTP Configuration
CREATE TABLE IF NOT EXISTS smtp_config (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification Settings
CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  on_success BOOLEAN DEFAULT 1,
  on_failure BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Application Settings
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  data_directory TEXT NOT NULL,
  backup_directory TEXT NOT NULL,
  max_concurrent_jobs INTEGER DEFAULT 3,
  retention_period INTEGER DEFAULT 30,
  compression_level INTEGER DEFAULT 6,
  enable_logging BOOLEAN DEFAULT 1,
  log_level TEXT DEFAULT 'info',
  auto_update_check BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS storage_providers_updated_at
AFTER UPDATE ON storage_providers
BEGIN
  UPDATE storage_providers SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS backup_jobs_updated_at
AFTER UPDATE ON backup_jobs
BEGIN
  UPDATE backup_jobs SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS smtp_config_updated_at
AFTER UPDATE ON smtp_config
BEGIN
  UPDATE smtp_config SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS notification_settings_updated_at
AFTER UPDATE ON notification_settings
BEGIN
  UPDATE notification_settings SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS settings_updated_at
AFTER UPDATE ON settings
BEGIN
  UPDATE settings SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
` 