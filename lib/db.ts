import Database from "better-sqlite3"
import path from "path"
import fs from "fs"
import logger from "@/lib/logger"

// Track active database connections
const activeConnections: Database.Database[] = [];

// Create a database connection
export function getDatabase() {
  // Get the database path from env or use default
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bucky.db")
  
  // Ensure the directory exists
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  
  // Log database connection
  logger.info(`Creating new database connection for thread/process ${process.pid}`)
  
  // Create a new database connection
  const db = new Database(dbPath, {
    verbose: (message) => logger.debug(`SQL: ${message}`),
  })
  
  // Configure SQLite for better concurrency and reliability
  db.pragma("journal_mode = WAL")
  db.pragma("busy_timeout = 5000")
  db.pragma("foreign_keys = ON")
  
  // Run migrations if needed
  runMigrations(db)
  
  // Track the connection
  activeConnections.push(db);
  
  // Return the database connection
  return db
}

// Close all active database connections
export function closeAllDatabases() {
  logger.info(`Closing ${activeConnections.length} database connections`);
  
  let closedCount = 0;
  const errors: Error[] = [];
  
  for (const db of activeConnections) {
    try {
      db.close();
      closedCount++;
    } catch (error) {
      errors.push(error as Error);
      logger.error("Error closing database connection:", { error });
    }
  }
  
  // Clear the array of tracked connections
  activeConnections.length = 0;
  
  logger.info(`Closed ${closedCount} database connections successfully`);
  
  if (errors.length > 0) {
    throw new Error(`Failed to close ${errors.length} database connections`);
  }
}

// Run database migrations
function runMigrations(db: Database.Database) {
  try {
    // Check if tables exist
    const tableCount = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number } | undefined;
    
    logger.info("Running database migrations...")
    
    // Start transaction
    db.prepare("BEGIN TRANSACTION;").run();
    
    // Run your migrations here...
    // This is just a placeholder - your actual migrations would go here
    
    // Commit transaction
    db.prepare("COMMIT;").run();
    
    logger.info("Database migrations completed successfully");
  } catch (error) {
    // Rollback on error
    db.prepare("ROLLBACK;").run();
    logger.error("Error running database migrations:", { error });
    throw error;
  }
}

// Define types for database entities
export interface BackupJob {
  id: string;
  name: string;
  source_path: string;
  storage_provider_id: string;
  schedule: string;
  remote_path: string;
  retention_period: number | null;
  compression_enabled: boolean;
  compression_level: number;
  status: "active" | "paused" | "in_progress" | "failed";
  next_run: string | null;
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageProvider {
  id: string;
  name: string;
  type: string;
  config: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

// Get a backup job by ID
export function getBackupJob(id: string): BackupJob | undefined {
  const db = getDatabase();
  try {
    return db.prepare(`
      SELECT * FROM backup_jobs WHERE id = ?
    `).get(id) as BackupJob | undefined;
  } catch (error) {
    logger.error(`Failed to get backup job with ID ${id}:`, { error });
    return undefined;
  }
}

// Create a new backup job
export function createBackupJob(job: Omit<BackupJob, 'id' | 'created_at' | 'updated_at'>): string {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  try {
    db.prepare(`
      INSERT INTO backup_jobs (
        id, name, source_path, storage_provider_id, schedule,
        remote_path, retention_period, compression_enabled,
        compression_level, status, next_run, last_run, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      job.name,
      job.source_path,
      job.storage_provider_id,
      job.schedule,
      job.remote_path,
      job.retention_period,
      job.compression_enabled ? 1 : 0,
      job.compression_level,
      job.status,
      job.next_run,
      job.last_run,
      now,
      now
    );
    
    logger.info(`Created new backup job: ${id} (${job.name})`);
    return id;
  } catch (error) {
    logger.error("Failed to create backup job:", { error, job });
    throw error;
  }
}

// Get a storage provider by ID
export function getStorageProvider(id: string): StorageProvider | undefined {
  const db = getDatabase();
  try {
    return db.prepare(`
      SELECT * FROM storage_providers WHERE id = ?
    `).get(id) as StorageProvider | undefined;
  } catch (error) {
    logger.error(`Failed to get storage provider with ID ${id}:`, { error });
    return undefined;
  }
}

// Create a new storage provider
export function createStorageProvider(provider: Omit<StorageProvider, 'id' | 'created_at' | 'updated_at'>): string {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  try {
    db.prepare(`
      INSERT INTO storage_providers (
        id, name, type, config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      provider.name,
      provider.type,
      provider.config,
      now,
      now
    );
    
    logger.info(`Created new storage provider: ${id} (${provider.name})`);
    return id;
  } catch (error) {
    logger.error("Failed to create storage provider:", { error, provider: { ...provider, config: '***REDACTED***' } });
    throw error;
  }
} 