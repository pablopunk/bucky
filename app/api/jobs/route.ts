import { NextResponse } from "next/server";
import { createBackupJob, getBackupJob, getDatabase } from "@/lib/db";
import { getBreeScheduler } from "@/lib/backup";
import { StorageProviderManager } from "@/lib/storage";
import { z } from "zod";
import type { BackupJob } from "@/lib/db";

const backupJobSchema = z.object({
  name: z.string().min(1),
  sourcePath: z.string().min(1),
  storageProviderId: z.string().min(1),
  schedule: z.string().min(1),
  remotePath: z.string().min(1),
  retentionPeriod: z.number().min(1).optional(),
  compressionEnabled: z.boolean().optional().default(true),
  compressionLevel: z.number().min(0).max(9).default(6),
  notifications: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const jobId = searchParams.get("id");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const db = getDatabase();

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
      ).run([
        crypto.randomUUID(),
        jobId,
        "failed",
        now,
        now,
        0,
        "Job stopped manually",
        now,
      ]);

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
      ).run(Date.now(), jobId);

      // Run the job with Bree
      await scheduler.runJobNow(jobId);
      return NextResponse.json({ success: true });
    }

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
      retention_period: validatedData.retentionPeriod || null,
      compression_enabled: validatedData.compressionEnabled,
      compression_level: validatedData.compressionLevel,
      status: "active" as const,
      next_run: null,
      last_run: null
    });

    // Schedule the job using the Bree scheduler
    const scheduler = getBreeScheduler();
    
    // Reload jobs in the scheduler to pick up the new job
    await scheduler.loadJobs();
    
    console.log(`New job ${newJobId} created and scheduler reloaded`);

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
    const db = getDatabase();
    const jobs = db.prepare(`
      SELECT 
        id, name, source_path, storage_provider_id,
        schedule, retention_period, compression_enabled,
        compression_level, status, next_run, last_run,
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
    
    // Reload jobs in the scheduler to remove the deleted job
    const scheduler = getBreeScheduler();
    await scheduler.loadJobs();
    
    console.log(`Job ${id} deleted and scheduler reloaded`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete backup job" },
      { status: 500 }
    );
  }
} 