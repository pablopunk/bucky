// Worker file for executing backup jobs
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { Database } from 'bun:sqlite';
import nodemailer from 'nodemailer';

// Simple function to generate random IDs
function generateRandomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 21; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Create a simple logger that writes to both console and log file
const logger = {
  logsDir: process.env.LOGS_DIR || path.join(process.cwd(), "logs"),
  
  getLogFilePath(type = 'jobs') {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logsDir, `${type}-${date}.log`);
  },
  
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  },
  
  write(level, message) {
    const formattedMessage = this.formatMessage(level, message);
    
    // Ensure logs directory exists
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    // Write to console
    console[level](formattedMessage);
    
    // Write to file
    try {
      fs.appendFileSync(this.getLogFilePath(), formattedMessage + '\n');
    } catch (err) {
      console.error(`Failed to write to log file: ${err.message}`);
    }
  },
  
  info(message) {
    this.write('log', message);
  },
  
  warn(message) {
    this.write('warn', message);
  },
  
  error(message) {
    this.write('error', message);
  }
};

// Get job ID from environment variables or worker data
let jobId;

// Self-initializing async function
(async () => {
  if (process.env.JOB_ID) {
    jobId = process.env.JOB_ID;
    logger.info(`Worker starting backup job from env: ${jobId}`);
  } else {
    try {
      const { workerData } = await import('worker_threads');
      jobId = workerData?.id;
      logger.info(`Worker starting backup job from worker data: ${jobId}`);
    } catch (error) {
      logger.error(`Failed to get job ID from worker data: ${error.message}`);
      process.exit(1);
    }
  }

  if (!jobId) {
    logger.error('No job ID provided!');
    process.exit(1);
  }

  // Start the job
  runBackup(jobId).catch(err => {
    logger.error(`Uncaught error in worker: ${err.message}`, err.stack);
    process.exit(1);
  });
})();

/**
 * Run a backup job with rclone using a PUSH strategy to make remote an exact copy of local
 * @param {string} jobId - The ID of the backup job to run
 * @returns {Promise<void>}
 */
async function runBackup(jobId) {
  let db = null;
  let configPath = null;
  
  try {
    logger.info(`Worker starting backup job: ${jobId}`);
    
    // Initialize database connection
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, "bucky.db");
    logger.info(`Opening database at: ${dbPath}`);
    db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA busy_timeout = 5000");
    db.run("PRAGMA foreign_keys = ON");
    
    // Update job status to in_progress
    db.query(`UPDATE backup_jobs SET status = ?, updated_at = ? WHERE id = ?`).run(
      'in_progress',
      Date.now(),
      jobId
    );

    // Get job details
    const job = db.query(`
      SELECT * FROM backup_jobs WHERE id = ?
    `).get(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found in database`);
    }
    
    // Get storage provider
    const provider = db.query(`
      SELECT * FROM storage_providers WHERE id = ?
    `).get(job.storage_provider_id);
    
    if (!provider) {
      throw new Error(`Storage provider ${job.storage_provider_id} not found`);
    }
    
    logger.info(`Running backup job: ${job.name}`);
    logger.info(`Source: ${job.source_path}`);
    logger.info(`Provider: ${provider.name} (${provider.type})`);
    
    // Parse provider config
    let credentials;
    try {
      credentials = JSON.parse(provider.config);
    } catch (error) {
      throw new Error(`Failed to parse storage provider config: ${error.message}`);
    }

    if (!credentials.bucket) {
      throw new Error(`Storage provider is missing required 'bucket' configuration`);
    }
    
    // Backup process start time
    const startTime = Date.now();
    
    // Ensure source path is absolute
    let sourcePath = job.source_path;
    if (!path.isAbsolute(sourcePath)) {
      sourcePath = path.resolve(process.cwd(), sourcePath);
    }
    
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }
    
    // Ensure source path has trailing slash for directory sync
    if (!sourcePath.endsWith(path.sep)) {
      sourcePath = sourcePath + path.sep;
    }
    
    // Create a temporary rclone config file based on provider type
    configPath = path.join(os.tmpdir(), `bucky_rclone_${jobId}.conf`);
    
    // Create rclone config based on provider type
    const remoteName = 'remote';
    let configContent = '';
    
    if (provider.type === 'storj') {
      configContent = `
[${remoteName}]
type = s3
provider = Other
access_key_id = ${credentials.accessKey}
secret_access_key = ${credentials.secretKey}
endpoint = ${credentials.endpoint || 'https://gateway.storjshare.io'}
force_path_style = true
no_check_certificate = true
`;
    } else if (provider.type === 's3') {
      configContent = `
[${remoteName}]
type = s3
provider = AWS
access_key_id = ${credentials.accessKey}
secret_access_key = ${credentials.secretKey}
region = ${credentials.region || 'us-east-1'}
endpoint = ${credentials.endpoint || ''}
`;
    } else if (provider.type === 'b2') {
      configContent = `
[${remoteName}]
type = b2
account = ${credentials.accountId}
key = ${credentials.applicationKey}
`;
    } else {
      throw new Error(`Unsupported storage provider type: ${provider.type}`);
    }
    
    // Write the rclone config file
    fs.writeFileSync(configPath, configContent);
    logger.info(`Created rclone config file at: ${configPath}`);
    
    // Define remote path - Format should be remoteName:bucket/path
    let remotePath;
    
    if (provider.type === 'storj' || provider.type === 's3') {
      // For S3-compatible storage, include the bucket in the path
      remotePath = `${remoteName}:${credentials.bucket}${job.remote_path.startsWith('/') ? job.remote_path : '/' + job.remote_path}`;
    } else if (provider.type === 'b2') {
      // For B2, the bucket is already part of the remote configuration
      remotePath = `${remoteName}:${job.remote_path.startsWith('/') ? job.remote_path.substring(1) : job.remote_path}`;
    } else {
      // Default fallback
      remotePath = `${remoteName}:${credentials.bucket}${job.remote_path.startsWith('/') ? job.remote_path : '/' + job.remote_path}`;
    }
    
    logger.info(`Remote path: ${remotePath}`);
    
    // Run rclone sync with --delete-after to ensure remote matches local exactly
    logger.info(`Starting backup: rclone sync "${sourcePath}" "${remotePath}" --delete-after`);
    
    try {
      const rcloneArgs = [
        'sync',
        sourcePath,
        remotePath,
        '--config', configPath,
        '--delete-after',  // Delete files on remote that don't exist locally
        '--progress',
        '--transfers', '16',  // Increase concurrent transfers for better performance
        '--fast-list',  // Use fast list if available for better directory handling
        '-v',  // Verbose output for better logging
      ];
      
      // Add compression if enabled
      if (job.compression_enabled) {
        // Note: The --compress flag is not supported in this version of rclone
        // We could use --compress-level if it were supported, but for now we'll just log this
        logger.info(`Compression requested but --compress flag not supported in this rclone version. Ignoring compression setting.`);
      }
      
      // Log full command for debugging
      const fullCommand = `rclone ${rcloneArgs.join(' ')}`;
      logger.info(`Full rclone command: ${fullCommand}`);
      
      // Log config file content (with sensitive data obscured)
      const sanitizedConfig = configContent.replace(/(secret_access_key|access_key_id|key|account)\s*=\s*[^\n]*/g, '$1 = ***REDACTED***');
      logger.info(`Using rclone config:\n${sanitizedConfig}`);
      
      logger.info(`Running rclone...`);
      
      const rclone = spawn('rclone', rcloneArgs);
      
      let output = '';
      let transferred = 0;
      let deleted = 0;
      let errors = 0;
      
      rclone.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        logger.info(`[rclone] ${text.trim()}`);
        
        // Extract transfer info if available
        if (text.includes('Transferred:')) {
          const match = text.match(/Transferred:\s+(\d+) \/ (\d+)/);
          if (match && match[2]) {
            transferred = parseInt(match[2], 10);
          }
        }
        
        // Track deletions
        if (text.includes('Deleted:')) {
          const match = text.match(/Deleted:\s+(\d+)/);
          if (match && match[1]) {
            deleted = parseInt(match[1], 10);
          }
        }
      });
      
      rclone.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        logger.error(`[rclone error] ${text.trim()}`);
        
        // Count errors
        if (text.includes('ERROR')) {
          errors++;
        }
      });
      
      // Wait for rclone to complete
      const rcloneExitCode = await new Promise((resolve) => {
        rclone.on('close', (code) => {
          logger.info(`rclone exited with code ${code}`);
          resolve(code);
        });
      });
      
      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;
      
      logger.info(`Backup completed in ${durationSeconds.toFixed(2)} seconds`);
      logger.info(`Files transferred: ${transferred}`);
      logger.info(`Files deleted: ${deleted}`);
      logger.info(`Errors encountered: ${errors}`);
      
      // Determine backup status
      const backupStatus = rcloneExitCode === 0 ? 'success' : 'failed';
      const statusMessage = rcloneExitCode === 0 
        ? `Backup completed successfully. Files transferred: ${transferred}, Files deleted: ${deleted}`
        : `Backup failed with exit code ${rcloneExitCode}. Please check logs.`;
      
      // Create backup history entry
      const historyId = generateRandomId();
      logger.info(`Creating backup history entry with ID: ${historyId}`);
      
      db.query(`
        INSERT INTO backup_history (
          id, job_id, status, start_time, end_time, 
          duration, size, message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        historyId,
        jobId,
        backupStatus,
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString(),
        durationSeconds,
        0, // We don't have size info
        statusMessage,
        new Date().toISOString()
      );
      
      logger.info(`Backup history entry created successfully`);
      
      // On completion, update the job status and last_run time
      const newJobStatus = rcloneExitCode === 0 ? 'active' : 'failed';
      logger.info(`Updating job status to: ${newJobStatus}`);
      
      db.query(`UPDATE backup_jobs SET status = ?, last_run = ?, updated_at = ? WHERE id = ?`).run(
        newJobStatus,
        new Date().toISOString(),
        Date.now(),
        jobId
      );
      
      logger.info(`Job status updated to ${newJobStatus}`);
      
      // Verify the job status update
      const updatedJob = db.query(`SELECT status FROM backup_jobs WHERE id = ?`).get(jobId);
      logger.info(`Verified job status: ${updatedJob ? updatedJob.status : 'unknown'}`);
      
      // If the backup failed, throw an error to trigger error handling
      if (rcloneExitCode !== 0) {
        throw new Error(`Backup failed with exit code ${rcloneExitCode}`);
      }
      
      // Send email notification about backup job result
      await sendNotification(job.name, rcloneExitCode === 0, statusMessage, db);
      
    } catch (rcloneError) {
      logger.error(`Error spawning rclone process: ${rcloneError.message}`, rcloneError.stack);
      throw rcloneError;
    }
    
  } catch (error) {
    logger.error(`Error in backup job: ${error.message}`, error.stack);
    
    try {
      if (!db) {
        // If we don't have a DB connection yet, create one
        const dataDir = path.join(process.cwd(), "data");
        const dbPath = path.join(dataDir, "bucky.db");
        db = new Database(dbPath);
      }
      
      // Update job status to failed
      db.query(`UPDATE backup_jobs SET status = ?, updated_at = ? WHERE id = ?`).run(
        'failed',
        Date.now(),
        jobId
      );
      
      // Create error entry in history
      db.query(`
        INSERT INTO backup_history (
          id, job_id, status, start_time, end_time, 
          size, message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateRandomId(),
        jobId,
        'failed',
        new Date().toISOString(),
        new Date().toISOString(),
        0,
        error.message,
        new Date().toISOString()
      );
      
      // Get job details for notification
      const job = db.query(`SELECT name FROM backup_jobs WHERE id = ?`).get(jobId);
      if (job) {
        // Send failure notification
        await sendNotification(job.name, false, error.message, db);
      }
      
    } catch (historyError) {
      logger.error(`Error creating backup history entry: ${historyError.message}`);
    }
    
    // Signal error to parent if using worker threads
    try {
      const { parentPort } = await import('worker_threads');
      if (parentPort) parentPort.postMessage('error');
    } catch (error) {
      // Not running in worker threads mode, exit with error
      process.exit(1);
    }
  } finally {
    // Clean up the rclone config file
    if (configPath && fs.existsSync(configPath)) {
      try {
        fs.unlinkSync(configPath);
        logger.info(`Removed temporary rclone config file: ${configPath}`);
      } catch (err) {
        logger.warn(`Failed to delete temp config file: ${err.message}`);
      }
    }
    
    // Ensure database is closed if still open
    if (db) {
      try {
        db.close();
        logger.info('Database connection closed');
      } catch (err) {
        logger.error(`Error closing database: ${err.message}`);
      }
    }
  }
}

/**
 * Send email notification about backup job result
 */
async function sendNotification(jobName, success, message, db) {
  try {
    // Get notification settings - use the correct table name without any conditions
    const notificationSettings = db.query(
      "SELECT email, on_success, on_failure FROM notification_settings LIMIT 1"
    ).get();
    
    if (!notificationSettings) {
      logger.info("No notification settings found, skipping email notification");
      return;
    }
    
    logger.info(`Notification settings found: on_success=${notificationSettings.on_success}, on_failure=${notificationSettings.on_failure}`);
    
    // Check if notification should be sent based on success/failure settings
    if ((success && !notificationSettings.on_success) || (!success && !notificationSettings.on_failure)) {
      logger.info(`Notification not sent: success=${success}, on_success=${notificationSettings.on_success}, on_failure=${notificationSettings.on_failure}`);
      return;
    }
    
    // Get SMTP configuration
    const smtpConfig = db.query(
      "SELECT * FROM smtp_config LIMIT 1"
    ).get();
    
    if (!smtpConfig) {
      logger.warn("SMTP configuration not found, cannot send notification");
      return;
    }
    
    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },
    });
    
    // Prepare email content
    const subject = `Backup Job ${success ? "Succeeded" : "Failed"}: ${jobName}`;
    const html = `
      <h2>Backup Job ${success ? "Succeeded" : "Failed"}</h2>
      <p><strong>Job Name:</strong> ${jobName}</p>
      <p><strong>Status:</strong> ${success ? "Success" : "Failed"}</p>
      <p><strong>Message:</strong> ${message}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `;
    
    // Send email
    await transporter.sendMail({
      from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
      to: notificationSettings.email,
      subject: subject,
      html: html,
    });
    
    logger.info(`Email notification sent to ${notificationSettings.email}`);
  } catch (error) {
    logger.error(`Failed to send email notification: ${error.message}`);
  }
}

// Catch any unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection in worker: ${reason}`);
  process.exit(1);
});

// Export function for programmatic use
export default runBackup;