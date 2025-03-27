import { BackupEngine } from "./engine";
import { BackupJob, StorageProvider } from "../db";
import { parseExpression } from "cron-parser";
import { addDays, isBefore } from "date-fns";
import { getDatabase } from "../db";
import { StorageProviderManager } from "../storage";
import { sendBackupNotification } from "../email";
import { NotificationSettings } from "../db";
import { sendEmail } from "../email";
import { generateUUID } from "../crypto";

export class BackupScheduler {
  private jobs: Map<string, ReturnType<typeof setTimeout>>;
  private engine: BackupEngine | null = null;
  private isShuttingDown: boolean = false;
  private checkInterval: ReturnType<typeof setInterval>;

  constructor(private storageProvider: StorageProviderManager) {
    this.jobs = new Map();
    // Handle graceful shutdown
    process.on('SIGTERM', () => this.handleShutdown());
    process.on('SIGINT', () => this.handleShutdown());
    
    // Start the check interval
    this.checkInterval = setInterval(() => this.checkAndRunJobs(), 60000); // Check every minute
  }

  private async handleShutdown() {
    this.isShuttingDown = true;
    console.log('Shutting down scheduler...');
    
    // Clear the check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Cancel all running jobs
    for (const [jobId, timeout] of this.jobs.entries()) {
      console.log(`Cancelling job ${jobId}`);
      clearTimeout(timeout);
      this.jobs.delete(jobId);
    }

    // Wait for any in-progress backups to complete
    if (this.engine) {
      // Add a timeout to prevent hanging
      setTimeout(() => {
        console.log('Shutdown timeout reached, forcing exit');
        process.exit(0);
      }, 30000); // 30 second timeout
    } else {
      process.exit(0);
    }
  }

  private async checkAndRunJobs() {
    if (this.isShuttingDown) return;

    try {
      const db = getDatabase();
      const now = new Date();
      
      // Get all active jobs that should run now
      const jobs = db.prepare(
        `SELECT * FROM backup_jobs 
         WHERE status = 'active' 
         AND next_run <= ?`
      ).all(now.toISOString()) as BackupJob[];

      for (const job of jobs) {
        await this.runJob(job);
        // Reschedule the job for its next run
        await this.scheduleJob(job);
      }
    } catch (error) {
      console.error('Error checking jobs:', error);
    }
  }

  async scheduleJob(job: BackupJob): Promise<void> {
    if (this.isShuttingDown) {
      console.log('Scheduler is shutting down, not scheduling new jobs');
      return;
    }

    try {
      // Parse cron expression
      const interval = parseExpression(job.schedule);
      const nextRun = interval.next().toDate();

      console.log(`Scheduling job ${job.id} (${job.name}) to run at ${nextRun.toISOString()}`);

      // Update job status in database
      const db = getDatabase();
      db.prepare(
        `UPDATE backup_jobs 
         SET status = ?, next_run = ? 
         WHERE id = ?`
      ).run("active", nextRun.toISOString(), job.id);

      // Cancel any existing timeout for this job
      this.cancelJob(job.id);

      // Schedule the job to run at the next run time
      const now = new Date();
      const delay = Math.max(0, nextRun.getTime() - now.getTime());
      
      if (delay < 60000) {
        // If next run is less than a minute away, schedule it to run in the next check
        console.log(`Job ${job.id} scheduled to run very soon (${delay}ms), will run in next check cycle`);
      } else {
        console.log(`Job ${job.id} scheduled to run in ${Math.floor(delay / 60000)} minutes`);
      }
    } catch (error) {
      console.error(`Error scheduling job ${job.id}:`, error);
      // Update job status to failed
      const db = getDatabase();
      db.prepare(
        `UPDATE backup_jobs 
         SET status = ?, next_run = NULL 
         WHERE id = ?`
      ).run("failed", job.id);
    }
  }

  private async recordBackupHistory(job: BackupJob, success: boolean, error?: string) {
    const db = getDatabase();
    const startTime = new Date().toISOString();
    const endTime = new Date().toISOString();

    db.prepare(
      `INSERT INTO backup_history (
        id, job_id, status, start_time, end_time,
        size, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateUUID(),
      job.id,
      success ? "success" : "failed",
      startTime,
      endTime,
      0, // Size will be updated after upload
      error || null,
      new Date().toISOString()
    );
  }

  async runJob(job: BackupJob): Promise<void> {
    const db = getDatabase();
    const startTime = new Date().toISOString();
    
    try {
      // Update job status
      db.prepare(
        `UPDATE backup_jobs 
         SET status = ?, last_run = ? 
         WHERE id = ?`
      ).run("in_progress", startTime, job.id);

      // Get storage provider
      const provider = await this.getStorageProvider(job.storage_provider_id);
      this.engine = new BackupEngine(provider);

      if (!this.engine) {
        throw new Error("Failed to initialize backup engine");
      }

      // Run backup
      const result = await this.engine.createBackup(job);

      // Record backup history
      db.prepare(
        `INSERT INTO backup_history (
          id, job_id, status, start_time, end_time,
          size, message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        generateUUID(),
        job.id,
        result.success ? "success" : "failed",
        startTime,
        new Date().toISOString(),
        result.size,
        result.error || null,
        new Date().toISOString()
      );

      // Update job status
      db.prepare(
        `UPDATE backup_jobs 
         SET status = ?, last_run = ? 
         WHERE id = ?`
      ).run(result.success ? "active" : "failed", startTime, job.id);

      // Send email notification
      await this.sendNotification(job, result.success, result.error || "");

      // Clean up old backups if retention period is set
      if (job.retention_period && job.retention_period > 0) {
        await this.cleanupOldBackups(job);
      }
    } catch (error) {
      // Record error in history
      db.prepare(
        `INSERT INTO backup_history (
          id, job_id, status, start_time, end_time,
          size, message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        generateUUID(),
        job.id,
        "failed",
        startTime,
        new Date().toISOString(),
        null,
        error instanceof Error ? error.message : "Unknown error",
        new Date().toISOString()
      );

      // Update job status
      db.prepare(
        `UPDATE backup_jobs 
         SET status = ?, last_run = ? 
         WHERE id = ?`
      ).run("failed", startTime, job.id);

      // Send email notification for failure
      await this.sendNotification(job, false, error instanceof Error ? error.message : "Unknown error");
    }
  }

  private async getStorageProvider(providerId: string) {
    const db = getDatabase();
    const provider = db.prepare(
      `SELECT * FROM storage_providers WHERE id = ?`
    ).get(providerId) as StorageProvider;
    
    if (!provider) {
      throw new Error(`Storage provider ${providerId} not found`);
    }

    const config = JSON.parse(provider.config);
    return this.storageProvider.create(config);
  }

  private async cleanupOldBackups(job: BackupJob): Promise<void> {
    if (!job.retention_period || !this.engine) return;
    
    const backups = await this.engine.listBackups(job.name);
    const cutoffDate = addDays(new Date(), -job.retention_period);

    for (const backup of backups) {
      const backupDate = new Date(backup.split("/").pop() || "");
      if (isBefore(backupDate, cutoffDate)) {
        await this.engine.deleteBackup(backup);
      }
    }
  }

  cancelJob(jobId: string): void {
    const timeout = this.jobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.jobs.delete(jobId);
    }
  }

  async loadJobs(): Promise<void> {
    try {
      const db = getDatabase();
      console.log("Loading jobs from database...");
      
      const jobs = db.prepare(
        `SELECT * FROM backup_jobs WHERE status = 'active'`
      ).all() as BackupJob[];

      console.log(`Found ${jobs.length} active jobs:`, jobs);
      
      // Schedule or update all active jobs
      for (const job of jobs) {
        try {
          console.log(`Processing job ${job.id} (${job.name}), current next_run:`, job.next_run);
          
          // Always calculate a new next_run time to ensure it's accurate
          const interval = parseExpression(job.schedule);
          const nextRun = interval.next().toDate();
          
          console.log(`Calculated new next_run for job ${job.id}: ${nextRun.toISOString()}`);
          
          db.prepare(
            `UPDATE backup_jobs 
             SET next_run = ? 
             WHERE id = ?`
          ).run(nextRun.toISOString(), job.id);
          
          // Update job in-memory with the new next_run time
          job.next_run = nextRun.toISOString();
          
          console.log(`Updated job ${job.id} in database with next_run: ${nextRun.toISOString()}`);
        } catch (error) {
          console.error(`Error parsing cron for job ${job.id} (${job.name}):`, error);
          
          // Mark jobs with invalid cron expressions as failed
          db.prepare(
            `UPDATE backup_jobs 
             SET status = ?, next_run = NULL 
             WHERE id = ?`
          ).run("failed", job.id);
        }
      }
      
      console.log('All jobs scheduled successfully');
      
      // Verify the jobs were actually updated in the database
      const updatedJobs = db.prepare(
        `SELECT id, name, next_run FROM backup_jobs WHERE status = 'active'`
      ).all();
      console.log("Updated jobs in database:", updatedJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  }

  private async sendNotification(job: BackupJob, success: boolean, message: string) {
    try {
      const db = getDatabase()
      const notificationSettings = db.prepare(
        "SELECT * FROM notification_settings ORDER BY id DESC LIMIT 1"
      ).get() as { email: string; on_success: boolean; on_failure: boolean } | null

      if (!notificationSettings) {
        console.log("No notification settings found, skipping email notification")
        return
      }

      if ((success && notificationSettings.on_success) || (!success && notificationSettings.on_failure)) {
        const subject = `Backup Job ${success ? "Succeeded" : "Failed"}: ${job.name}`
        const html = `
          <h2>Backup Job ${success ? "Succeeded" : "Failed"}</h2>
          <p><strong>Job Name:</strong> ${job.name}</p>
          <p><strong>Status:</strong> ${success ? "Success" : "Failed"}</p>
          <p><strong>Message:</strong> ${message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `

        await sendEmail(notificationSettings.email, subject, html)
      }
    } catch (error) {
      console.error("Failed to send email notification:", error)
      // Don't throw the error, just log it
    }
  }
} 