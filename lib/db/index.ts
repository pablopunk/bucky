import Database from "better-sqlite3"
import path from "path"
import { schema } from "./schema"
import { runMigrations } from "./migrations"
import fs from "fs"

// Cache for database connections
const connections = new Map<number, Database.Database>()
let schemaInitialized = false

// Get or create a database connection for the current thread/process
export function getDatabase(): Database.Database {
  // Get unique identifier for the current thread/process
  const threadId = process.pid || 1

  if (!connections.has(threadId)) {
    console.log(`Creating new database connection for thread/process ${threadId}`)
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), "data")
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    // Initialize database
    const dbPath = path.join(dataDir, "bucky.db")
    const db = new Database(dbPath, {
      // Set busy timeout to handle concurrent access
      timeout: 5000, // 5 second timeout
      // Use WAL mode for better concurrency
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    })
    
    // Enable WAL mode for better concurrency
    db.pragma("journal_mode = WAL")
    
    // Set busy timeout
    db.pragma("busy_timeout = 5000")
    
    // Enable foreign keys
    db.pragma("foreign_keys = ON")
    
    // Cache connection
    connections.set(threadId, db)
    
    // Initialize schema only once
    if (!schemaInitialized) {
      try {
        // Check if the schema needs to be initialized
        const tableCount = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }
        
        if (tableCount.count === 0) {
          console.log("Initializing database schema...")
          // Initialize schema - execute as a single transaction
          db.exec(schema)
          schemaInitialized = true
        }
        
        // Run migrations for schema updates
        runMigrations()
      } catch (error) {
        console.error("Error initializing database:", error)
      }
    }
  }
  
  return connections.get(threadId)!
}

// Close database connection for the current thread
export function closeDatabase(): void {
  const threadId = process.pid || 1
  
  if (connections.has(threadId)) {
    try {
      const db = connections.get(threadId)!
      db.close()
      connections.delete(threadId)
      console.log(`Closed database connection for thread/process ${threadId}`)
    } catch (error) {
      console.error(`Error closing database connection for thread/process ${threadId}:`, error)
    }
  }
}

// Close all database connections
export function closeAllDatabases(): void {
  for (const [threadId, db] of connections.entries()) {
    try {
      db.close()
      console.log(`Closed database connection for thread/process ${threadId}`)
    } catch (error) {
      console.error(`Error closing database connection for thread/process ${threadId}:`, error)
    }
  }
  
  connections.clear()
}

// Helper functions for common database operations
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = getDatabase()
  return db.prepare(sql).all(...params) as T[]
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const db = getDatabase()
  return db.prepare(sql).get(...params) as T | null
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  const db = getDatabase()
  db.prepare(sql).run(...params)
}

// Type definitions for database tables
export interface StorageProvider {
  id: string
  name: string
  type: string
  config: string
  status: string
  created_at: string
  updated_at: string
}

export interface BackupJob {
  id: string
  name: string
  source_path: string
  schedule: string
  storage_provider_id: string
  remote_path: string
  retention_period: number | null
  compression_enabled: boolean
  compression_level: number
  status: "active" | "paused" | "failed" | "in_progress"
  next_run: string | null
  last_run: string | null
  created_at: string
  updated_at: string
}

export interface BackupHistory {
  id: string
  job_id: string
  status: string
  start_time: string
  end_time: string | null
  duration: number | null
  size: number | null
  compression_ratio: number | null
  message: string | null
  created_at: string
}

export interface SMTPConfig {
  id: string
  host: string
  port: number
  username: string
  password: string
  from_email: string
  from_name: string
  created_at: string
  updated_at: string
}

export interface NotificationSettings {
  id: string
  email: string
  on_success: boolean
  on_failure: boolean
  created_at: string
  updated_at: string
}

export interface Settings {
  id: string
  data_directory: string
  backup_directory: string
  max_concurrent_jobs: number
  retention_period: number
  compression_level: number
  enable_logging: boolean
  log_level: string
  auto_update_check: boolean
  theme?: string
  created_at: string
  updated_at: string
}

// Utility functions for common operations
export function generateId(): string {
  return crypto.randomUUID()
}

export function getTimestamp(): string {
  return new Date().toISOString()
}

// Storage Provider operations
export function createStorageProvider(data: Omit<StorageProvider, "id" | "created_at" | "updated_at">) {
  const db = getDatabase()
  const id = generateId()
  const now = getTimestamp()
  
  db.prepare(
    `INSERT INTO storage_providers (id, name, type, config, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.name, data.type, data.config, data.status, now, now)
  
  return id
}

export function getStorageProvider(id: string): StorageProvider | null {
  const db = getDatabase()
  return db.prepare(
    `SELECT * FROM storage_providers WHERE id = ?`
  ).get(id) as StorageProvider | null
}

// SMTP Config operations
export function createSmtpConfig(data: Omit<SMTPConfig, "id" | "created_at" | "updated_at">) {
  const db = getDatabase()
  const id = generateId()
  const now = getTimestamp()
  
  db.prepare(
    `INSERT INTO smtp_config (
      id, host, port, username, password, from_email, from_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, data.host, data.port, data.username, data.password,
    data.from_email, data.from_name, now, now
  )
  
  return id
}

export function getSmtpConfig(): SMTPConfig | null {
  const db = getDatabase()
  return db.prepare(
    `SELECT * FROM smtp_config ORDER BY id DESC LIMIT 1`
  ).get() as SMTPConfig | null
}

// Backup Job operations
export function createBackupJob(data: Omit<BackupJob, "id" | "created_at" | "updated_at">) {
  const db = getDatabase()
  const id = generateId()
  const now = getTimestamp()
  
  db.prepare(
    `INSERT INTO backup_jobs (
      id, name, source_path, storage_provider_id, schedule,
      retention_period, compression_enabled, compression_level, status,
      next_run, last_run, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.name,
    data.source_path,
    data.storage_provider_id,
    data.schedule,
    data.retention_period || null,
    data.compression_enabled ? 1 : 0,
    data.compression_level,
    data.status,
    data.next_run || null,
    data.last_run || null,
    now,
    now
  )
  
  return id
}

export function getBackupJob(id: string): BackupJob | null {
  const db = getDatabase()
  return db.prepare(
    `SELECT * FROM backup_jobs WHERE id = ?`
  ).get(id) as BackupJob | null
}

// Export types from schema
export * from "./schema" 