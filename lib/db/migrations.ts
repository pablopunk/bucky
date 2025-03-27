import { getDatabase } from './index';

interface ColumnResult {
  count: number;
}

/**
 * Run database migrations to ensure latest schema
 */
export function runMigrations() {
  const db = getDatabase();
  
  console.log('Running database migrations...');
  
  // SQLite doesn't support IF NOT EXISTS for ALTER TABLE
  // So we need to check if columns exist first using pragma_table_info
  
  // Execute migrations within a single transaction for atomicity
  db.exec('BEGIN TRANSACTION;');
  
  try {
    // Add next_run column if it doesn't exist
    const hasNextRun = db.prepare(`SELECT COUNT(*) as count FROM pragma_table_info('backup_jobs') WHERE name='next_run'`).get() as ColumnResult;
    if (hasNextRun.count === 0) {
      console.log('Adding next_run column to backup_jobs table');
      db.exec(`ALTER TABLE backup_jobs ADD COLUMN next_run INTEGER NULL;`);
    }
    
    // Add last_run column if it doesn't exist
    const hasLastRun = db.prepare(`SELECT COUNT(*) as count FROM pragma_table_info('backup_jobs') WHERE name='last_run'`).get() as ColumnResult;
    if (hasLastRun.count === 0) {
      console.log('Adding last_run column to backup_jobs table');
      db.exec(`ALTER TABLE backup_jobs ADD COLUMN last_run INTEGER NULL;`);
    }
    
    // Add remote_path column if it doesn't exist
    const hasRemotePath = db.prepare(`SELECT COUNT(*) as count FROM pragma_table_info('backup_jobs') WHERE name='remote_path'`).get() as ColumnResult;
    if (hasRemotePath.count === 0) {
      console.log('Adding remote_path column to backup_jobs table');
      db.exec(`ALTER TABLE backup_jobs ADD COLUMN remote_path TEXT NOT NULL DEFAULT '/';`);
    }
    
    // Add compression_level column if it doesn't exist
    const hasCompressionLevel = db.prepare(`SELECT COUNT(*) as count FROM pragma_table_info('backup_jobs') WHERE name='compression_level'`).get() as ColumnResult;
    if (hasCompressionLevel.count === 0) {
      console.log('Adding compression_level column to backup_jobs table');
      db.exec(`ALTER TABLE backup_jobs ADD COLUMN compression_level INTEGER NOT NULL DEFAULT 6;`);
    }
    
    // Run migration for notification_settings if the email column doesn't exist
    const hasEmailColumn = db.prepare(`SELECT COUNT(*) as count FROM pragma_table_info('notification_settings') WHERE name='email'`).get() as ColumnResult;
    if (hasEmailColumn.count === 0) {
      console.log('Running migration to update notification_settings table structure');
      
      // Run the notification_settings table migration
      const migration = migrations.find(m => m.name === "update_notification_settings_table");
      if (migration) {
        console.log(`Executing migration: ${migration.name}`);
        db.exec(migration.sql);
        console.log(`Migration completed: ${migration.name}`);
      }
    } else {
      console.log('Notification settings table already has email column, skipping migration');
    }
    
    // Check if the theme column exists in settings table
    const hasThemeColumn = db.prepare(`SELECT COUNT(*) as count FROM pragma_table_info('settings') WHERE name='theme'`).get() as ColumnResult;
    if (hasThemeColumn.count === 0) {
      console.log('Adding theme column to settings table');
      db.exec(`ALTER TABLE settings ADD COLUMN theme TEXT DEFAULT 'system';`);
    }
    
    // Create app_config table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Commit transaction
    db.exec('COMMIT;');
    console.log('Database migrations completed successfully');
  } catch (error) {
    // Rollback on any error
    db.exec('ROLLBACK;');
    console.error('Error during database migrations:', error);
    throw error;
  }
}

// Add a migration to alter notification_settings table
export const migrations = [
  // Migration to fix the notification_settings table
  {
    name: "update_notification_settings_table",
    sql: `
      -- Create a backup of the old table
      CREATE TABLE IF NOT EXISTS notification_settings_backup (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        on_success BOOLEAN DEFAULT 1,
        on_failure BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Copy existing data (only on_success and on_failure columns)
      INSERT INTO notification_settings_backup (id, email, on_success, on_failure, created_at, updated_at)
      SELECT id, '' as email, on_success, on_failure, created_at, updated_at
      FROM notification_settings;

      -- Drop the old table
      DROP TABLE notification_settings;

      -- Rename the backup table to the original name
      ALTER TABLE notification_settings_backup RENAME TO notification_settings;
    `
  }
]; 