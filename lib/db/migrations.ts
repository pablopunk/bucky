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