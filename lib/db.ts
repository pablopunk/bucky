import { Database } from "bun:sqlite"
import path from "path"
import { schema } from "./db/schema"
import { runMigrations } from "./db/migrations"
import fs from "fs"
import logger from "@/lib/logger"
import { generateUUID } from "./crypto"

// Cache for database connections
const connections = new Map<number, Database>()
let schemaInitialized = false

// Track active database connections
const activeConnections: Database[] = [];

// Get or create a database connection for the current thread/process
export function getDatabase(): Database {
  // Get unique identifier for the current thread/process
  const threadId = process.pid || 1

  if (!connections.has(threadId)) {
    logger.info(`Creating new database connection for thread/process ${threadId}`)
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), "data")
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    // Initialize database
    const dbPath = path.join(dataDir, "bucky.db")
    const db = new Database(dbPath)
    
    // Enable WAL mode for better concurrency
    db.run("PRAGMA journal_mode = WAL")
    
    // Set busy timeout
    db.run("PRAGMA busy_timeout = 5000")
    
    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON")
    
    // Cache connection
    connections.set(threadId, db)
    
    // Initialize schema only once
    if (!schemaInitialized) {
      try {
        // Check if the schema needs to be initialized
        const tableCount = db.query("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }
        
        if (tableCount.count === 0) {
          logger.info("Initializing database schema...")
          // Initialize schema - execute as a single transaction
          db.exec(schema)
          schemaInitialized = true
        }
        
        // Run migrations for schema updates
        runMigrations()
      } catch (error) {
        logger.error("Error initializing database:", error)
      }
    }
  }
  
  // Track the connection
  activeConnections.push(connections.get(threadId)!)
  
  return connections.get(threadId)!
}

// For compatibility with legacy code patterns that use prepare().run()
export function prepareStatement(sql: string): { run: (...params: any[]) => void; get: (...params: any[]) => any; all: (...params: any[]) => any[] } {
  const db = getDatabase();
  const statement = db.query(sql);
  
  return {
    run: (...params: any[]) => statement.run(...params),
    get: (...params: any[]) => statement.get(...params),
    all: (...params: any[]) => statement.all(...params)
  };
}

// Close database connection for the current thread
export function closeDatabase(): void {
  const threadId = process.pid || 1
  
  if (connections.has(threadId)) {
    try {
      const db = connections.get(threadId)!
      db.close()
      connections.delete(threadId)
      logger.info(`Closed database connection for thread/process ${threadId}`)
    } catch (error) {
      logger.error(`Error closing database connection for thread/process ${threadId}:`, error)
    }
  }
}

// Close all database connections
export function closeAllDatabases(): void {
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

// Helper functions for common database operations
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = getDatabase()
  return db.query(sql).all(...params) as T[]
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const db = getDatabase()
  return db.query(sql).get(...params) as T | null
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  const db = getDatabase()
  db.run(sql, ...params)
}

// For backwards compatibility with API routes
export const prepare = prepareStatement;

// Export all from our database module for easy imports
export * from "./db/index";

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
  const id = generateUUID();
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
  const id = generateUUID();
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