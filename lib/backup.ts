import { jobLogger } from "@/lib/logger"
import { getBackupJob, getDatabase, getStorageProvider } from "@/lib/db"
import { execa } from "execa"
import path from "path"
import fs from "fs"
import nodemailer from "nodemailer"
import { generateUUID } from "./crypto"
import { parseRcloneSize, formatBytes } from "./utils"
import { parseExpression } from 'cron-parser'

// Define a type for the Bree scheduler
interface BreeScheduler {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  add: (jobs: any[]) => void;
  loadJobs: () => Promise<void>;
  runJobNow: (jobId: string) => Promise<void>;
}

// Bree scheduler instance
let breeScheduler: BreeScheduler | null = null;

// Initialize the Bree scheduler
export async function initializeScheduler() {
  jobLogger.info("Initializing Bree backup scheduler...")
  try {
    // Dynamic import for server-side only
    const { default: Bree } = await import('bree')
    
    breeScheduler = new Bree({
      jobs: [],
      root: false,
      errorHandler: (error: Error, workerMetadata: any) => {
        jobLogger.error(`Job ${workerMetadata.name} failed:`, { error: error.message, stack: error.stack })
      }
    }) as unknown as BreeScheduler;
    
    // Add the runJobNow method to the scheduler
    if (!breeScheduler.runJobNow) {
      breeScheduler.runJobNow = async (jobId: string) => {
        jobLogger.info(`Manually running job with ID: ${jobId}`);
        // Implement logic to run a job immediately
        await runBackupJob(jobId);
      };
    }
    
    await breeScheduler.start()
    jobLogger.info("Bree scheduler started successfully")
    
    // Load jobs from database
    await scheduleJobs()
    
    return breeScheduler
  } catch (error) {
    jobLogger.error("Failed to initialize Bree scheduler:", { error })
    throw error
  }
}

// Get the Bree scheduler instance
export function getBreeScheduler() {
  if (!breeScheduler) {
    // Create a simple scheduler with the runJobNow method if no scheduler exists
    jobLogger.warn("Bree scheduler not initialized, creating a simple scheduler");
    
    breeScheduler = {
      start: async () => jobLogger.info("Simple scheduler started"),
      stop: async () => jobLogger.info("Simple scheduler stopped"),
      add: (jobs) => jobLogger.info(`Added ${jobs.length} jobs to simple scheduler`),
      loadJobs: async () => jobLogger.info("Loaded jobs in simple scheduler"),
      runJobNow: async (jobId) => {
        jobLogger.info(`[SIMPLE SCHEDULER] Manually running job with ID: ${jobId}`);
        // Actually run the backup job
        await runBackupJob(jobId);
      }
    }
  }
  
  return breeScheduler
}

// Schedule jobs from database
export function scheduleJobs() {
  jobLogger.info("Loading jobs from database...")
  // Implementation would load jobs from database and schedule them
  // This is a placeholder
  return Promise.resolve()
}

// Function to calculate and update the next run time for a job
export async function updateNextRunTime(jobId: string): Promise<void> {
  const db = getDatabase();
  
  try {
    // Get the job details
    const job = getBackupJob(jobId);
    if (!job) {
      jobLogger.error(`Cannot update next_run for job ${jobId}: Job not found`);
      return;
    }
    
    // Skip if job is paused or has no schedule
    if (job.status === 'paused' || !job.schedule) {
      jobLogger.info(`Job ${jobId} is paused or has no schedule, skipping next_run update`);
      return;
    }
    
    try {
      // Parse cron expression to get next run time
      const interval = parseExpression(job.schedule);
      const nextRun = interval.next().toDate();
      
      // Update next_run time in database
      jobLogger.info(`Updating next_run for job ${jobId} to ${nextRun.toISOString()}`);
      db.prepare(`
        UPDATE backup_jobs SET next_run = ? WHERE id = ?
      `).run(nextRun.toISOString(), jobId);
      
    } catch (error: any) {
      jobLogger.error(`Failed to calculate next run time for job ${jobId}:`, { error: error.message });
      // Don't throw here, as we don't want a bad schedule to break everything
    }
  } catch (error: any) {
    jobLogger.error(`Error updating next run time for job ${jobId}:`, { error: error.message });
  }
}

// Creates a temporary rclone config file for this job
async function createRcloneConfig(providerId: string): Promise<string> {
  try {
    const provider = getStorageProvider(providerId);
    if (!provider) {
      throw new Error(`Storage provider with ID ${providerId} not found`);
    }
    
    // More detailed logging to debug the provider
    jobLogger.info(`Provider details: ${JSON.stringify({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      hasConfig: provider.hasOwnProperty('config'),
      providerKeys: Object.keys(provider)
    }, null, 2)}`);
    
    // The database schema uses "config" field instead of "credentials" field
    const providerConfig = provider.config;
    
    // Check if config/credentials property exists at all in the provider object
    if (!providerConfig) {
      const db = getDatabase();
      
      // Log the table structure to help diagnose the issue
      try {
        const tableInfo = db.prepare("PRAGMA table_info(storage_providers)").all();
        jobLogger.info(`Storage providers table structure: ${JSON.stringify(tableInfo, null, 2)}`);
        
        // Check the actual provider record
        const providerRecord = db.prepare("SELECT * FROM storage_providers WHERE id = ?").get(providerId) as any;
        if (providerRecord) {
          const safeRecord = {...providerRecord, config: providerRecord.config ? '[REDACTED]' : null};
          jobLogger.info(`Provider record: ${JSON.stringify(safeRecord, null, 2)}`);
        } else {
          jobLogger.warn(`No provider record found for ID ${providerId}`);
        }
      } catch (error: any) {
        jobLogger.error(`Failed to get table info: ${error.message}`);
      }
      
      throw new Error(`Storage provider ${provider.name} (${providerId}) has no config data. Please check your storage provider configuration.`);
    }
    
    // Parse credentials from JSON string
    let credentials;
    try {
      // Handle empty string as empty object
      if (typeof providerConfig === 'string') {
        if (providerConfig.trim() === '') {
          credentials = {};
          jobLogger.warn(`Provider ${provider.name} has empty config string, using empty object`);
        } else {
          credentials = JSON.parse(providerConfig);
        }
      } else if (typeof providerConfig === 'object') {
        // If it's already an object, use it directly
        credentials = providerConfig;
      } else {
        throw new Error(`Unexpected config type: ${typeof providerConfig}`);
      }
    } catch (parseError: any) {
      // Log the actual credentials string for debugging
      jobLogger.error(`Config parse error for ${provider.name}: ${parseError.message}`);
      throw new Error(`Invalid config format for storage provider ${provider.name}: ${parseError.message}`);
    }
    
    // Validate required credential fields
    if (!credentials) {
      throw new Error(`Storage provider ${provider.name} has empty credentials`);
    }
    
    // Validate credentials based on provider type - using consistent field names matching the database
    if (provider.type === 'storj' && (!credentials.accessKey || !credentials.secretKey)) {
      throw new Error(`Storj provider ${provider.name} is missing required credentials (accessKey/secretKey)`);
    }
    
    // Create a temporary directory for the config
    const configDir = path.join(process.cwd(), "tmp", "rclone");
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Create a unique config file for this job
    const configFile = path.join(configDir, `rclone-${Date.now()}-${Math.floor(Math.random() * 1000)}.conf`);
    
    // Generate different config based on provider type
    let configContent = '';
    
    if (provider.type === 'storj') {
      configContent = `
[${provider.name}]
type = s3
provider = Storj
access_key_id = ${credentials.accessKey}
secret_access_key = ${credentials.secretKey}
endpoint = ${credentials.endpoint || 'https://gateway.storjshare.io'}
location_constraint = 
acl = ${credentials.acl || 'private'}
force_path_style = true
`;
    } else {
      throw new Error(`Unsupported provider type: ${provider.type}`);
    }
    
    // Write the config file
    fs.writeFileSync(configFile, configContent);
    jobLogger.info(`Created rclone config file at ${configFile}`);
    
    jobLogger.info("Config content:", configContent);
    
    return configFile;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    jobLogger.error(`Failed to create rclone config:`, { error: errorMessage });
    throw error;
  }
}

// Build the rclone command for a backup job
function buildRcloneCommand(job: any, configFile: string, providerName: string): [string, string[]] {
  // Format remote path correctly as providerName:bucket/path
  // Get the provider for bucket info
  const provider = getStorageProvider(job.storage_provider_id);
  if (!provider) {
    throw new Error(`Storage provider ${job.storage_provider_id} not found`);
  }
  
  // Parse provider config to get bucket
  let credentials;
  try {
    credentials = JSON.parse(provider.config);
  } catch (error) {
    throw new Error(`Failed to parse storage provider config: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Ensure remote path format is correct: providerName:bucket/path
  const remotePath = `${providerName}:${credentials.bucket}${job.remote_path.startsWith('/') ? job.remote_path : '/' + job.remote_path}`;
  
  // Base rclone command
  const command = "rclone"
  const args = [
    'sync',
    job.source_path,
    remotePath,
    `--config=${configFile}`,
    '-v'
  ]
  
  const noCheckCertificate = false;
  if (noCheckCertificate) {
    args.push('--no-check-certificate')
  }
  
  // Add options based on job settings
  if (job.compression_enabled) {
    args.push(`--compress-level=${job.compression_level || 6}`)
  }
  
  // Add common options
  args.push('--progress', '--stats=1s')
  
  return [command, args];
}

// Run a specific backup job
export async function runBackupJob(jobId: string) {
  jobLogger.info(`Starting backup job: ${jobId}`);
  
  // Get the database connection
  const db = getDatabase();
  let configFile: string | null = null;
  
  try {
    // Get the job details from the database
    const job = getBackupJob(jobId);
    if (!job) {
      throw new Error(`Backup job with ID ${jobId} not found`);
    }
    
    // Update job status to in_progress
    jobLogger.info(`Updating job status to in_progress for job ${jobId}`);
    db.prepare(`
      UPDATE backup_jobs 
      SET status = 'in_progress', updated_at = ? 
      WHERE id = ?
    `).run(new Date().toISOString(), jobId);
    
    // Create history record for this execution
    const historyId = generateUUID();
    const startTime = new Date().toISOString();
    
    jobLogger.info(`Creating history record for job ${jobId} with ID ${historyId}`);
    db.prepare(`
      INSERT INTO backup_history (
        id, job_id, status, start_time, end_time,
        size, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      historyId,
      jobId,
      'running',
      startTime,
      null,
      0,
      'Job started',
      startTime
    );
    
    // Create rclone config for this job
    configFile = await createRcloneConfig(job.storage_provider_id);
    
    // Get the provider name for the rclone command
    const provider = getStorageProvider(job.storage_provider_id);
    if (!provider) {
      throw new Error(`Storage provider ${job.storage_provider_id} not found`);
    }
    
    // Build the rclone command
    const [command, args] = buildRcloneCommand(job, configFile, provider.name);
    jobLogger.info(`Running rclone command: ${command} ${args.join(' ')}`);
    
    // Execute the rclone command
    const { stdout, stderr, failed, message, exitCode } = await execa(command, args);
    
    // Still log the output to the console
    stdout.split('\n').forEach(line => jobLogger.info(line))
    stderr.split('\n').forEach(line => jobLogger.info(line))
    
    if (failed || exitCode !== 0) {
        throw new Error(`Rclone command failed: ${message} ${stderr}`)
    }

    // Parse output to get size and other stats
    // Calculate the actual size in bytes
    const sizeBytes = parseRcloneSize(stdout);
    
    // Format the size properly with appropriate units
    const sizeStr = formatBytes(sizeBytes);
    
    // Extract number of transferred files
    const transferredMatch = stdout.match(/Transferred:\s+(\d+)\s+\/\s+(\d+)/);
    const transferred = transferredMatch && transferredMatch[2] ? parseInt(transferredMatch[2], 10) : 0;
    
    // Extract number of deleted files
    const deletedMatch = stdout.match(/Deleted:\s+(\d+)/);
    const deleted = deletedMatch && deletedMatch[1] ? parseInt(deletedMatch[1], 10) : 0;
    
    // Update job as completed
    const endTime = new Date().toISOString();
    
    jobLogger.info(`Backup job ${jobId} completed successfully. Size: ${sizeStr}, Files transferred: ${transferred}, Files deleted: ${deleted}`);
    
    // Update job status in the database
    db.prepare(`
      UPDATE backup_jobs 
      SET status = 'active', last_run = ?, updated_at = ? 
      WHERE id = ?
    `).run(endTime, endTime, jobId);
    
    // Update history record with detailed message
    db.prepare(`
      UPDATE backup_history 
      SET status = 'success', end_time = ?, size = ?, message = ? 
      WHERE id = ?
    `).run(
      endTime, 
      sizeBytes.toString(), // Store raw bytes in database for consistent sorting
      `Backup completed successfully. Files transferred: ${transferred}, Files deleted: ${deleted}`, 
      historyId
    );
    
    // Send email notification for successful job
    try {
      const successMessage = `Backup completed successfully. Size: ${sizeStr}, Files transferred: ${transferred}, Files deleted: ${deleted}`;
      await sendJobSuccessNotification(job.name, successMessage);
      jobLogger.info(`Sent success notification email for job ${jobId}`);
    } catch (notifyError: any) {
      jobLogger.error(`Error sending success notification: ${notifyError.message}`);
    }
    
    // Update the next_run time for this job
    await updateNextRunTime(jobId);
    
    return { success: true, size: sizeStr };
  } catch (error: any) {
    jobLogger.error(`Failed to run backup job: ${jobId}`, { error: error.message || 'Unknown error' });
    
    // Update job status to failed in the database
    try {
      const endTime = new Date().toISOString();
      const errorMessage = error.message || 'Unknown error';
      
      // Update job status
      db.prepare(`
        UPDATE backup_jobs 
        SET status = 'failed', updated_at = ? 
        WHERE id = ?
      `).run(endTime, jobId);
      
      // Update history record if it exists
      db.prepare(`
        UPDATE backup_history 
        SET status = 'failed', end_time = ?, message = ? 
        WHERE job_id = ? AND end_time IS NULL
      `).run(endTime, `Error: ${errorMessage}`, jobId);
      
      // Get the job name for notification
      const job = db.prepare(`SELECT name FROM backup_jobs WHERE id = ?`).get(jobId) as { name: string } | undefined;
      
      // Send email notification for failed job
      try {
        await sendJobFailureNotification(job?.name || jobId, errorMessage);
        jobLogger.info(`Sent failure notification email for job ${jobId}`);
      } catch (notifyError: any) {
        jobLogger.error(`Error sending notification: ${notifyError.message}`);
      }
      
      // Still try to update next_run time, if the job is not completely broken
      await updateNextRunTime(jobId);
    } catch (dbError) {
      jobLogger.error(`Failed to update job status for ${jobId}:`, { error: dbError });
    }
    
    throw error;
  } finally {
    // Clean up temp config file
    if (configFile && fs.existsSync(configFile)) {
      try {
        fs.unlinkSync(configFile);
        jobLogger.debug(`Removed temporary config file: ${configFile}`);
      } catch (error: any) {
        jobLogger.error(`Failed to remove temp config file ${configFile}:`, { error });
      }
    }
  }
}

// Shutdown the scheduler
export async function shutdownScheduler() {
  jobLogger.info("Shutting down Bree scheduler...")
  if (breeScheduler) {
    try {
      await breeScheduler.stop()
      jobLogger.info("Bree scheduler stopped successfully")
    } catch (error) {
      jobLogger.error("Error stopping Bree scheduler:", { error })
      throw error
    }
  }
}

// Function to send email notification for job failures
async function sendJobFailureNotification(jobName: string, errorMessage: string): Promise<void> {
  try {
    // Get SMTP settings from database
    const db = getDatabase();
    const smtpConfig = db.prepare('SELECT * FROM smtp_config LIMIT 1').get() as any;
    
    if (!smtpConfig) {
      throw new Error('No SMTP configuration found in database');
    }
    
    // Log SMTP config for debugging (redact password)
    const smtpDebug = {...smtpConfig};
    if (smtpDebug.password) smtpDebug.password = '******';
    jobLogger.info(`SMTP config: ${JSON.stringify(smtpDebug)}`);
    
    // Get notification settings (all recipients, without filtering by enabled status)
    // This avoids assuming 'enabled' column exists
    const notificationSettings = db.prepare('SELECT * FROM notification_settings').all() as any[];
    
    jobLogger.info(`Found ${notificationSettings.length} notification settings records`);
    
    if (!notificationSettings || notificationSettings.length === 0) {
      throw new Error('No notification recipients found');
    }
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure === 1,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      }
    });
    
    // Prepare email content
    const subject = `Backup Job Failed: ${jobName}`;
    const text = `
    Backup Job Failure Notification
    
    Job Name: ${jobName}
    Time: ${new Date().toLocaleString()}
    Error: ${errorMessage}
    
    Please check the logs for more details.
    `;
    
    const html = `
    <h2>Backup Job Failure Notification</h2>
    <p>A backup job has failed.</p>
    <table border="0" cellpadding="5">
      <tr>
        <td><strong>Job Name:</strong></td>
        <td>${jobName}</td>
      </tr>
      <tr>
        <td><strong>Time:</strong></td>
        <td>${new Date().toLocaleString()}</td>
      </tr>
      <tr>
        <td><strong>Error:</strong></td>
        <td style="color: red;">${errorMessage}</td>
      </tr>
    </table>
    <p>Please check the logs for more details.</p>
    `;
    
    // Send to all recipients
    for (const recipient of notificationSettings) {
      // Skip recipients without email addresses
      if (!recipient.email) {
        jobLogger.warn(`Skipping notification recipient without email address: ${JSON.stringify(recipient)}`);
        continue;
      }
      
      // Skip if failure notifications are disabled for this recipient
      if (recipient.on_failure === 0 || recipient.on_failure === false) {
        jobLogger.info(`Failure notifications disabled for ${recipient.email}, skipping`);
        continue;
      }
      
      try {
        await transporter.sendMail({
          from: smtpConfig.sender_email || smtpConfig.username,
          to: recipient.email,
          subject,
          text,
          html
        });
        
        jobLogger.info(`Sent failure notification email to ${recipient.email} for job ${jobName}`);
      } catch (emailError: any) {
        jobLogger.error(`Failed to send email to ${recipient.email}: ${emailError.message}`);
        // Continue with other recipients even if one fails
      }
    }
  } catch (error: any) {
    jobLogger.error(`Failed to send email notification: ${error.message}`);
    throw error;
  }
}

// Function to send email notification for job successes
async function sendJobSuccessNotification(jobName: string, message: string): Promise<void> {
  try {
    // Get SMTP settings from database
    const db = getDatabase();
    const smtpConfig = db.prepare('SELECT * FROM smtp_config LIMIT 1').get() as any;
    
    if (!smtpConfig) {
      throw new Error('No SMTP configuration found in database');
    }
    
    // Log SMTP config for debugging (redact password)
    const smtpDebug = {...smtpConfig};
    if (smtpDebug.password) smtpDebug.password = '******';
    jobLogger.info(`SMTP config: ${JSON.stringify(smtpDebug)}`);
    
    // Get notification settings (all recipients, without filtering by enabled status)
    // This avoids assuming 'enabled' column exists
    const notificationSettings = db.prepare('SELECT * FROM notification_settings').all() as any[];
    
    jobLogger.info(`Found ${notificationSettings.length} notification settings records`);
    
    if (!notificationSettings || notificationSettings.length === 0) {
      throw new Error('No notification recipients found');
    }
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure === 1,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      }
    });
    
    // Prepare email content
    const subject = `Backup Job Succeeded: ${jobName}`;
    const text = `
    Backup Job Success Notification
    
    Job Name: ${jobName}
    Time: ${new Date().toLocaleString()}
    Message: ${message}
    
    Please check the logs for more details.
    `;
    
    const html = `
    <h2>Backup Job Success Notification</h2>
    <p>A backup job has succeeded.</p>
    <table border="0" cellpadding="5">
      <tr>
        <td><strong>Job Name:</strong></td>
        <td>${jobName}</td>
      </tr>
      <tr>
        <td><strong>Time:</strong></td>
        <td>${new Date().toLocaleString()}</td>
      </tr>
      <tr>
        <td><strong>Message:</strong></td>
        <td>${message}</td>
      </tr>
    </table>
    <p>Please check the logs for more details.</p>
    `;
    
    // Send to all recipients
    for (const recipient of notificationSettings) {
      // Skip recipients without email addresses
      if (!recipient.email) {
        jobLogger.warn(`Skipping notification recipient without email address: ${JSON.stringify(recipient)}`);
        continue;
      }
      
      // Skip if success notifications are disabled for this recipient
      if (recipient.on_success === 0 || recipient.on_success === false) {
        jobLogger.info(`Success notifications disabled for ${recipient.email}, skipping`);
        continue;
      }
      
      try {
        await transporter.sendMail({
          from: smtpConfig.sender_email || smtpConfig.username,
          to: recipient.email,
          subject,
          text,
          html
        });
        
        jobLogger.info(`Sent success notification email to ${recipient.email} for job ${jobName}`);
      } catch (emailError: any) {
        jobLogger.error(`Failed to send email to ${recipient.email}: ${emailError.message}`);
        // Continue with other recipients even if one fails
      }
    }
  } catch (error: any) {
    jobLogger.error(`Failed to send email notification: ${error.message}`);
    throw error;
  }
}