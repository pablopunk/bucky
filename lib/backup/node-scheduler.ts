import { join } from 'path';
import { getDatabase, closeDatabase } from '../db';
import { parseExpression } from 'cron-parser';
import { fork } from 'child_process';
import * as schedule from 'node-schedule';
import pRetry from 'p-retry';
import type { BackupJob } from '../db';

// Queue for running jobs to prevent database locking
const runningJobsQueue: string[] = [];
let isProcessingQueue = false;

export class NodeScheduler {
  private jobs = new Map<string, schedule.Job>();
  private isRunning = false;
  private runningJobs = new Map<string, boolean>();
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialize
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doStart();
    return this.initPromise;
  }

  private async doStart(): Promise<void> {
    try {
      console.log('Starting Node Scheduler...');
      
      // Load all jobs from database
      await this.loadJobs();
      
      this.isRunning = true;
      console.log('Node Scheduler started successfully');
      
      // Setup auto-reload every 5 minutes to catch new or updated jobs
      setInterval(() => this.loadJobs(), 5 * 60 * 1000);
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      this.initPromise = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('Stopping Node Scheduler...');
      
      // Cancel all scheduled jobs
      for (const [jobId, scheduledJob] of this.jobs.entries()) {
        scheduledJob.cancel();
        console.log(`Cancelled scheduled job: ${jobId}`);
      }
      
      this.jobs.clear();
      this.isRunning = false;
      this.initPromise = null;
      console.log('Node Scheduler stopped successfully');
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
      throw error;
    }
  }

  // Process one job at a time from the queue
  private async processJobQueue() {
    if (isProcessingQueue || runningJobsQueue.length === 0) {
      return;
    }

    isProcessingQueue = true;

    try {
      const jobId = runningJobsQueue.shift();
      if (jobId && !this.runningJobs.has(jobId)) {
        console.log(`Processing queued job ${jobId}`);
        await this.executeJob(jobId);
      }
    } catch (error) {
      console.error('Error processing job queue:', error);
    } finally {
      isProcessingQueue = false;
      
      // If there are more jobs, process the next one
      if (runningJobsQueue.length > 0) {
        setTimeout(() => this.processJobQueue(), 100);
      }
    }
  }

  // Queue up a job to run
  async runJobNow(jobId: string): Promise<void> {
    if (this.runningJobs.has(jobId)) {
      console.log(`Job ${jobId} is already running`);
      return;
    }

    // Add job to queue and start processing
    runningJobsQueue.push(jobId);
    this.processJobQueue();
  }

  // Execute a job using child_process.fork
  private async executeJob(jobId: string): Promise<void> {
    if (this.runningJobs.has(jobId)) {
      console.log(`Job ${jobId} is already running, skipping execution`);
      return;
    }

    try {
      // Mark job as running
      this.runningJobs.set(jobId, true);
      
      // Get database connection
      const db = getDatabase();
      
      // Update job status to in_progress
      db.prepare(`UPDATE backup_jobs SET status = ?, updated_at = ? WHERE id = ?`)
        .run('in_progress', Date.now(), jobId);
      
      // Close database to avoid locking
      closeDatabase();
      
      // Run job with retries
      await pRetry(
        async () => {
          return new Promise<void>((resolve, reject) => {
            // Use child_process.fork to run the job in a separate process
            const workerPath = join(process.cwd(), 'lib/jobs/runBackup.js');
            const worker = fork(workerPath, [], {
              // Pass job ID as environment variable
              env: { ...process.env, JOB_ID: jobId },
              // Detach from parent process
              detached: false,
              // Inherit stdio
              stdio: 'inherit'
            });
            
            // Handle completion
            worker.on('exit', (code) => {
              if (code === 0) {
                console.log(`Job ${jobId} completed successfully`);
                resolve();
              } else {
                reject(new Error(`Job ${jobId} failed with exit code ${code}`));
              }
            });
            
            // Handle errors
            worker.on('error', (err) => {
              console.error(`Error running job ${jobId}:`, err);
              reject(err);
            });
          });
        },
        { 
          retries: 2,
          onFailedAttempt: error => {
            console.error(
              `Failed to run job ${jobId} (attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber}):`,
              error
            );
          }
        }
      );
      
      // Update job status to completed
      const db2 = getDatabase();
      db2.prepare(`UPDATE backup_jobs SET status = ?, last_run = ?, updated_at = ? WHERE id = ?`)
        .run('completed', Date.now(), Date.now(), jobId);
      closeDatabase();
      
    } catch (error) {
      console.error(`Failed to run job ${jobId} after multiple retries:`, error);
      
      // Update job status to failed in database
      try {
        const db = getDatabase();
        db.prepare(`UPDATE backup_jobs SET status = ?, updated_at = ? WHERE id = ?`).run(
          'failed', 
          Date.now(), 
          jobId
        );
        
        // Be sure to close any opened database connections
        closeDatabase();
      } catch (dbError) {
        console.error('Failed to update job status in database:', dbError);
      }
    } finally {
      // Mark job as not running anymore
      this.runningJobs.delete(jobId);
    }
  }

  async loadJobs(): Promise<void> {
    console.log('Loading jobs from database...');
    
    let db = null;
    
    try {
      db = getDatabase();
      const jobs = db.prepare(`
        SELECT * FROM backup_jobs 
        WHERE status != 'disabled' AND schedule IS NOT NULL
      `).all() as BackupJob[];

      console.log(`Found ${jobs.length} active backup jobs`);
      
      // Cancel all current jobs first
      for (const [jobId, scheduledJob] of this.jobs.entries()) {
        scheduledJob.cancel();
      }
      this.jobs.clear();
      
      // Schedule each job
      for (const job of jobs) {
        // Skip if job is already running
        if (this.runningJobs.has(job.id)) {
          console.log(`Job ${job.id} is currently running, skipping schedule update`);
          continue;
        }
        
        try {
          // Parse cron expression to get next run time
          const interval = parseExpression(job.schedule);
          const nextRun = interval.next().toDate();
          
          // Update next_run time in database
          db.prepare(`
            UPDATE backup_jobs SET next_run = ? WHERE id = ?
          `).run(nextRun.getTime(), job.id);
          
          console.log(`Job ${job.id} (${job.name}) scheduled for ${nextRun}`);
          
          // Schedule the job using node-schedule
          const scheduledJob = schedule.scheduleJob(job.schedule, () => {
            console.log(`Scheduled job ${job.id} (${job.name}) triggered at ${new Date()}`);
            // Execute the job
            this.runJobNow(job.id).catch(err => {
              console.error(`Error running scheduled job ${job.id}:`, err);
            });
          });
          
          // Store the scheduled job
          this.jobs.set(job.id, scheduledJob);
        } catch (error) {
          console.error(`Invalid schedule for job ${job.id}:`, error);
          
          // Mark job as failed due to invalid schedule
          db.prepare(`
            UPDATE backup_jobs SET status = ?, updated_at = ? WHERE id = ?
          `).run('failed', Date.now(), job.id);
        }
      }
      
      console.log(`Successfully scheduled ${this.jobs.size} jobs`);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      throw error;
    } finally {
      // Close database connection when done
      if (db) {
        closeDatabase();
      }
    }
  }
} 