import Bree from 'bree';
import { join } from 'path';
import { getDatabase, closeDatabase } from '../db';
import { parseExpression } from 'cron-parser';
import pRetry from 'p-retry';
import type { BackupJob } from '../db';
import type { Job } from 'bree';
import { generateUUID } from '../crypto';

// Queue for running jobs to prevent database locking
const runningJobsQueue: string[] = [];
let isProcessingQueue = false;

export class BreeScheduler {
  private bree: Bree;
  private isRunning = false;
  private jobsMap = new Map<string, boolean>();
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Create a configuration object that's compatible with TypeScript
    const breeConfig: any = {
      root: join(process.cwd(), 'lib/jobs'),
      jobs: [], // Will be populated on start
      // Worker configuration
      worker: {
        workerData: {
          // Shared data for all workers
          appRoot: process.cwd()
        }
      }
    };
    
    // Add register property conditionally to avoid TypeScript errors
    if (process.env.NODE_ENV !== 'production') {
      console.log('Adding register worker script for development mode');
      breeConfig.register = [join(process.cwd(), 'lib/jobs/register.js')];
    }
    
    this.bree = new Bree(breeConfig);
    
    // Error handler
    this.bree.on('worker created', (name) => {
      console.log(`Worker created for job ${name}`);
    });

    // Error handler
    this.bree.on('worker error', (error, workerMetadata) => {
      if (!workerMetadata || !workerMetadata.name) {
        console.error(`Worker error, but no metadata available:`, error);
        // Process next job in queue even if we don't know which job errored
        this.processJobQueue();
        return;
      }
      
      const { name } = workerMetadata;
      const jobId = name.replace('backup-', '');
      console.error(`Worker error in job ${jobId}:`, error);
      this.jobsMap.delete(jobId);
      
      // Process next job in queue
      this.processJobQueue();
    });
    
    // Message handler
    this.bree.on('worker message', (name, message) => {
      if (!name) {
        console.log(`Worker message received, but no name available:`, message);
        // Process next job in queue even if we don't know which job finished
        this.processJobQueue();
        return;
      }
      
      const jobId = name.replace('backup-', '');
      console.log(`Worker message for job ${jobId}:`, message);
      
      if (message === 'done' || message === 'error') {
        this.jobsMap.delete(jobId);
        // Process next job in queue
        this.processJobQueue();
      }
    });
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
      console.log('Starting Bree scheduler...');
      
      // Load all jobs from database
      await this.loadJobs();
      
      // Start Bree scheduler
      await this.bree.start();
      this.isRunning = true;
      console.log('Bree scheduler started successfully');
      
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
      console.log('Stopping Bree scheduler...');
      await this.bree.stop();
      this.isRunning = false;
      this.initPromise = null;
      console.log('Bree scheduler stopped successfully');
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
      if (jobId && !this.jobsMap.has(jobId)) {
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
    if (this.jobsMap.has(jobId)) {
      console.log(`Job ${jobId} is already running`);
      return;
    }

    // Add job to queue and start processing
    runningJobsQueue.push(jobId);
    this.processJobQueue();
  }

  // Actually run the job with Bree
  private async executeJob(jobId: string): Promise<void> {
    if (this.jobsMap.has(jobId)) {
      console.log(`Job ${jobId} is already running, skipping execution`);
      return;
    }

    try {
      // Mark job as running
      this.jobsMap.set(jobId, true);
      
      // Run job with retries
      await pRetry(
        async () => {
          // Create a specific job just for immediate execution
          const path = join(process.cwd(), 'lib/jobs/runBackup.js');
          await this.bree.add({
            name: `backup-${jobId}`,
            path,
            worker: {
              workerData: {
                id: jobId
              }
            }
          });
          
          // Run the job
          await this.bree.run(`backup-${jobId}`);
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
    } catch (error) {
      console.error(`Failed to run job ${jobId} after multiple retries:`, error);
      this.jobsMap.delete(jobId);
      
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
      
      throw error;
    }
  }

  // Convert cron expression to milliseconds interval
  private getIntervalFromCron(cronExpression: string): number {
    try {
      const interval = parseExpression(cronExpression);
      const now = new Date();
      const next = interval.next().toDate();
      return next.getTime() - now.getTime();
    } catch (error) {
      console.error('Error parsing cron expression:', error);
      // Default to daily interval
      return 24 * 60 * 60 * 1000;
    }
  }

  async loadJobs(): Promise<void> {
    console.log('Loading jobs from database...');
    
    let db = null;
    
    try {
      db = getDatabase();
      const jobs = db.prepare(`
        SELECT * FROM backup_jobs 
        WHERE status = 'active' AND schedule IS NOT NULL
      `).all() as BackupJob[];

      console.log(`Found ${jobs.length} active backup jobs`);
      
      // Create new job definitions array
      const jobDefinitions: Job[] = [];
      
      // Process each job
      for (const job of jobs) {
        // Skip if job is already running
        if (this.jobsMap.has(job.id)) {
          console.log(`Job ${job.id} is currently running, skipping schedule update`);
          continue;
        }
        
        // Skip if schedule is empty
        if (!job.schedule || job.schedule.trim() === '') {
          console.log(`Job ${job.id} has an empty schedule, skipping`);
          continue;
        }
        
        try {
          // Parse cron expression to get next run time
          const interval = parseExpression(job.schedule);
          const nextRun = interval.next().toDate();
          
          // Update next_run time in database
          db.prepare(`
            UPDATE backup_jobs SET next_run = ? WHERE id = ?
          `).run(nextRun.toISOString(), job.id);
          
          console.log(`Job ${job.id} (${job.name}) scheduled for ${nextRun}`);
          
          // Calculate interval in ms for this job (until next run)
          const intervalMs = Math.max(1000, nextRun.getTime() - Date.now());
          
          // Create job definition for Bree using interval
          jobDefinitions.push({
            name: `backup-${job.id}`,
            path: join(process.cwd(), 'lib/jobs/runBackup.js'),
            // Use interval (in ms) instead of cron
            interval: intervalMs,
            worker: {
              workerData: {
                id: job.id,
                name: job.name
              }
            }
          } as Job);
        } catch (error) {
          console.error(`Invalid schedule for job ${job.id}:`, error);
          
          // Mark job as failed due to invalid schedule
          db.prepare(`
            UPDATE backup_jobs SET status = ?, updated_at = ? WHERE id = ?
          `).run('failed', new Date().toISOString(), job.id);
        }
      }
      
      // For paused jobs, explicitly set next_run to null
      db.prepare(`
        UPDATE backup_jobs SET next_run = NULL WHERE status = 'paused'
      `).run();
      
      // Also make sure "failed" and "in_progress" jobs that have been stuck have a correct next_run
      try {
        // Check for in_progress jobs that have been running for too long (1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const stuckJobs = db.prepare(`
          SELECT id, name, status FROM backup_jobs 
          WHERE status = 'in_progress' AND updated_at < ?
        `).all(oneHourAgo) as { id: string, name: string, status: string }[];
        
        if (stuckJobs.length > 0) {
          console.log(`Found ${stuckJobs.length} stuck in_progress jobs, resetting status`);
          
          for (const job of stuckJobs) {
            console.log(`Resetting stuck job ${job.id} (${job.name})`);
            
            // Update job status to failed
            db.prepare(`
              UPDATE backup_jobs SET status = 'failed', updated_at = ? WHERE id = ?
            `).run(new Date().toISOString(), job.id);
            
            // Add a history record
            db.prepare(`
              INSERT INTO backup_history (id, job_id, status, start_time, end_time, message, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              generateUUID(),
              job.id,
              'failed',
              new Date().toISOString(),
              new Date().toISOString(),
              'Job was stuck in progress for too long and was automatically reset',
              new Date().toISOString()
            );
          }
        }
        
        // Recalculate next_run for all active jobs with a schedule but missing next_run
        const jobsNeedingNextRun = db.prepare(`
          SELECT id, name, schedule FROM backup_jobs 
          WHERE status = 'active' AND schedule IS NOT NULL AND next_run IS NULL
        `).all() as { id: string, name: string, schedule: string }[];
        
        if (jobsNeedingNextRun.length > 0) {
          console.log(`Found ${jobsNeedingNextRun.length} active jobs missing next_run times`);
          
          for (const job of jobsNeedingNextRun) {
            try {
              // Skip if schedule is empty
              if (!job.schedule || job.schedule.trim() === '') {
                continue;
              }
              
              // Parse cron expression to get next run time
              const interval = parseExpression(job.schedule);
              const nextRun = interval.next().toDate();
              
              // Update next_run time in database
              db.prepare(`
                UPDATE backup_jobs SET next_run = ? WHERE id = ?
              `).run(nextRun.toISOString(), job.id);
              
              console.log(`Updated missing next_run for job ${job.id} (${job.name}) to ${nextRun}`);
            } catch (scheduleError) {
              console.error(`Failed to parse schedule for job ${job.id}:`, scheduleError);
            }
          }
        }
      } catch (maintenanceError) {
        console.error('Error during job maintenance:', maintenanceError);
      }
      
      // Update Bree's job array - remove all jobs first then add new definitions
      this.bree.remove();
      
      // Add each job individually
      for (const job of jobDefinitions) {
        await this.bree.add(job);
      }
      
      if (this.isRunning) {
        if (jobDefinitions.length > 0) {
          console.log(`Restarting scheduler with ${jobDefinitions.length} jobs`);
          await this.bree.stop();
          await this.bree.start();
        }
      }
      
      console.log(`Successfully loaded ${jobDefinitions.length} jobs into scheduler`);
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