// Worker file for executing backup jobs
const { resolve } = require('path');

// Get job ID from environment variables (used by NodeScheduler) or worker data (used by BreeScheduler)
let jobId;
if (process.env.JOB_ID) {
  jobId = process.env.JOB_ID;
  console.log(`Worker starting backup job from env: ${jobId}`);
} else {
  try {
    const { workerData } = require('worker_threads');
    jobId = workerData?.id;
    console.log(`Worker starting backup job from worker data: ${jobId}`);
  } catch (error) {
    console.error('Failed to get job ID from worker data:', error);
    process.exit(1);
  }
}

if (!jobId) {
  console.error('No job ID provided!');
  process.exit(1);
}

// Self-closing function
async function runBackup() {
  let db = null;
  
  try {
    console.log(`Worker starting backup job: ${jobId}`);
    
    // We need to require these modules inside the worker
    const { getDatabase, closeDatabase } = require(resolve('./lib/db'));
    const { BackupService } = require(resolve('./lib/backup/service'));
    
    // Get database connection - this will be a separate connection for this worker
    db = getDatabase();
    
    // Update job status to in_progress
    db.prepare(`UPDATE backup_jobs SET status = ?, updated_at = ? WHERE id = ?`).run(
      'in_progress',
      Date.now(),
      jobId
    );

    // Create backup service and run backup
    const backupService = new BackupService();
    await backupService.runBackup(jobId);
    
    // On success, update the job status and last_run time
    db.prepare(`UPDATE backup_jobs SET status = ?, last_run = ?, updated_at = ? WHERE id = ?`).run(
      'completed',
      Date.now(),
      Date.now(),
      jobId
    );
    
    console.log(`Worker completed backup job: ${jobId}`);
    
    // Close the database connection to prevent locking
    if (db) {
      closeDatabase();
      db = null;
    }
    
    // Signal successful completion to parent if using worker threads
    try {
      const { parentPort } = require('worker_threads');
      if (parentPort) parentPort.postMessage('done');
    } catch (error) {
      // Not running in worker threads mode, just exit
      process.exit(0);
    }
  } catch (error) {
    console.error(`Worker error in backup job:`, error);
    
    try {
      if (!db) {
        // If we don't have a DB connection yet, try to get one
        const { getDatabase, closeDatabase } = require(resolve('./lib/db'));
        db = getDatabase();
      }
      
      // Update job status to failed
      db.prepare(`UPDATE backup_jobs SET status = ?, updated_at = ? WHERE id = ?`).run(
        'failed',
        Date.now(),
        jobId
      );
      
      // Close the database connection to prevent locking
      closeDatabase();
      db = null;
    } catch (dbError) {
      console.error('Failed to update job status:', dbError);
    }
    
    // Signal error to parent if using worker threads
    try {
      const { parentPort } = require('worker_threads');
      if (parentPort) parentPort.postMessage('error');
    } catch (error) {
      // Not running in worker threads mode, exit with error
      process.exit(1);
    }
  } finally {
    // Ensure database is closed if still open
    if (db) {
      try {
        const { closeDatabase } = require(resolve('./lib/db'));
        closeDatabase();
      } catch (err) {
        console.error('Error closing database in finally block:', err);
      }
    }
  }
}

// Catch any unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in worker:', reason);
  process.exit(1);
});

// Start the job
runBackup().catch(err => {
  console.error('Uncaught error in worker:', err);
  process.exit(1);
}); 