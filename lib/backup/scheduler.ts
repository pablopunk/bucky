import { BackupEngine } from "./engine";
import { BackupJob, StorageProvider } from "../db";
import { parseExpression } from "cron-parser";
import { addDays, isBefore } from "date-fns";
import { getDatabase } from "../db";
import { StorageProviderManager } from "../storage";
import { sendBackupNotification } from "../email";
import { NotificationSettings } from "../db";
import { sendEmail } from "../email";

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

      // Update job status in database
      const db = getDatabase();
      db.prepare(
        `UPDATE backup_jobs 
         SET status = ?, next_run = ? 
         WHERE id = ?`
      ).run(["active" as const, nextRun.toISOString(), job.id]);

      console.log(`Scheduled job ${job.id} to run at ${nextRun.toISOString()}`);
    } catch (error) {
      console.error(`Error scheduling job ${job.id}:`, error);
      // Update job status to failed
      const db = getDatabase();
      db.prepare(
        `UPDATE backup_jobs 
         SET status = ?, next_run = NULL 
         WHERE id = ?`
      ).run(["failed" as const, job.id]);
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
    ).run([
      crypto.randomUUID(),
      job.id,
      success ? "success" : "failed",
      startTime,
      endTime,
      0, // Size will be updated after upload
      error || null,
      new Date().toISOString(),
    ]);
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
      ).run(["in_progress" as const, startTime, job.id]);

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
      ).run([
        crypto.randomUUID(),
        job.id,
        result.success ? "success" : "failed",
        startTime,
        new Date().toISOString(),
        result.size,
        result.error || null,
        new Date().toISOString(),
      ]);

      // Update job status
      db.prepare(
        `UPDATE backup_jobs 
         SET status = ?, last_run = ? 
         WHERE id = ?`
      ).run([result.success ? "active" as const : "failed" as const, startTime, job.id]);

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
        crypto.randomUUID(),
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
      ).run(["failed" as const, startTime, job.id]);

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
      const jobs = db.prepare(
        `SELECT * FROM backup_jobs WHERE status = 'active'`
      ).all() as BackupJob[];

      console.log(`Loading ${jobs.length} active jobs`);
      
      // Don't schedule jobs immediately, just let the check interval handle them
      for (const job of jobs) {
        // Just update the next_run time if needed
        if (!job.next_run) {
          const interval = parseExpression(job.schedule);
          const nextRun = interval.next().toDate();
          
          db.prepare(
            `UPDATE backup_jobs 
             SET next_run = ? 
             WHERE id = ?`
          ).run(nextRun.toISOString(), job.id);
        }
      }
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