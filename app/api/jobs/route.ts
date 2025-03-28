import { NextResponse } from "next/server";
import { createBackupJob, getBackupJob, getDatabase } from "@/lib/db";
import { getBreeScheduler, updateNextRunTime } from "@/lib/backup";
import { StorageProviderManager } from "@/lib/storage";
import { z } from "zod";
import type { BackupJob } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { generateUUID } from "@/lib/crypto";

const backupJobSchema = z.object({
  name: z.string().min(1),
  sourcePath: z.string().min(1),
  storageProviderId: z.string().min(1),
  schedule: z.string().min(1),
  remotePath: z.string().min(1),
  notifications: z.boolean().optional().default(true),
  retentionPeriod: z.number().nullable().optional(),
  compressionEnabled: z.boolean().optional().default(false),
  compressionLevel: z.number().optional().default(6),
});

export async function POST(request: Request) {
  try {
    apiLogger.info("POST /api/jobs request received")
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const jobId = searchParams.get("id");

    // Only require jobId if an action is specified
    if (action && !jobId) {
      return NextResponse.json(
        { error: "Job ID is required for this action" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Handle actions that require a job ID
    if (action) {
      // Ensure jobId is not null before using it in any action
      if (!jobId) {
        return NextResponse.json(
          { error: "Job ID is required for this action" },
          { status: 400 }
        );
      }

      if (action === "pause") {
        // Update the job status to paused
        db.prepare(
          `UPDATE backup_jobs 
           SET status = 'paused', 
               next_run = NULL,
               updated_at = ?
           WHERE id = ?`
        ).run(new Date().toISOString(), jobId);

        return NextResponse.json({ success: true });
      }

      if (action === "resume") {
        // Update the job status back to active
        db.prepare(
          `UPDATE backup_jobs 
           SET status = 'active', 
               updated_at = ?
           WHERE id = ?`
        ).run(new Date().toISOString(), jobId);

        // Calculate and update the next_run time
        await updateNextRunTime(jobId);

        return NextResponse.json({ success: true });
      }

      if (action === "stop") {
        db.prepare(
          `UPDATE backup_jobs 
           SET status = 'failed', 
               next_run = NULL
           WHERE id = ?`
        ).run(jobId);

        // Add a history record for the stopped job
        const job = db.prepare("SELECT name FROM backup_jobs WHERE id = ?").get(jobId) as { name: string } | undefined;
        const now = new Date().toISOString();
        
        db.prepare(
          `INSERT INTO backup_history (
            id, job_id, status, start_time, end_time,
            size, message, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          generateUUID(),
          jobId,
          "failed",
          now,
          now,
          0,
          "Job stopped manually",
          now
        );

        return NextResponse.json({ success: true });
      }

      if (action === "run") {
        // Use the Bree scheduler for running jobs
        const scheduler = getBreeScheduler();
        const job = getBackupJob(jobId);
        if (!job) {
          return NextResponse.json(
            { error: "Backup job not found" },
            { status: 404 }
          );
        }

        // Update job status to in_progress
        db.prepare(
          `UPDATE backup_jobs 
           SET status = 'in_progress', 
               updated_at = ?
           WHERE id = ?`
        ).run(new Date().toISOString(), jobId);

        // Run the job with Bree
        await scheduler.runJobNow(jobId);
        return NextResponse.json({ success: true });
      }
    }

    // If we get here, we're creating a new job (no action specified)
    const body = await request.json();
    const validatedData = backupJobSchema.parse(body);

    // Check if storage provider exists
    const provider = db.prepare(
      `SELECT id FROM storage_providers WHERE id = ?`
    ).get(validatedData.storageProviderId);

    if (!provider) {
      return NextResponse.json(
        { error: "Storage provider not found. Please create a storage provider first." },
        { status: 400 }
      );
    }

    // Create the backup job
    const newJobId = createBackupJob({
      name: validatedData.name,
      source_path: validatedData.sourcePath,
      storage_provider_id: validatedData.storageProviderId,
      schedule: validatedData.schedule,
      remote_path: validatedData.remotePath,
      status: "active" as const,
      next_run: null,
      last_run: null,
      retention_period: validatedData.retentionPeriod || null,
      compression_enabled: validatedData.compressionEnabled || false,
      compression_level: validatedData.compressionLevel || 6
    });

    // Calculate and update the next_run time for the new job
    await updateNextRunTime(newJobId);
    apiLogger.info(`New job ${newJobId} created with next_run time calculated`);

    return NextResponse.json({ id: newJobId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating backup job:", error);
    return NextResponse.json(
      { error: "Failed to create backup job" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    apiLogger.info("GET /api/jobs request received")
    const db = getDatabase();
    const jobs = db.prepare(`
      SELECT 
        id, name, source_path, storage_provider_id,
        schedule, status, remote_path, next_run, last_run,
        created_at, updated_at
      FROM backup_jobs
      ORDER BY name
    `).all() as BackupJob[];

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Error fetching backup jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch backup jobs" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    apiLogger.info("DELETE /api/jobs request received")
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Delete the job from the database
    const db = getDatabase();
    db.prepare(`DELETE FROM backup_jobs WHERE id = ?`).run(id);
    
    // No need to reload the jobs
    apiLogger.info(`Job ${id} deleted`);

    return NextResponse.json({ success: true });
  } catch (error) {
    apiLogger.error("Failed to delete backup job", { error });
    return NextResponse.json(
      { error: "Failed to delete backup job" },
      { status: 500 }
    );
  }
} 