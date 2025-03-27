import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { z } from "zod";

const updateJobSchema = z.object({
  name: z.string().min(1),
  sourcePath: z.string().min(1),
  storageProviderId: z.string().min(1),
  schedule: z.string().min(1),
  remotePath: z.string().min(1),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase();
    const job = db.prepare(
      `SELECT 
        id, name, source_path, storage_provider_id,
        schedule, remote_path, status, next_run, last_run,
        created_at, updated_at
      FROM backup_jobs
      WHERE id = ?`
    ).get(params.id);

    if (!job) {
      return NextResponse.json(
        { error: "Backup job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("Error fetching backup job:", error);
    return NextResponse.json(
      { error: "Failed to fetch backup job" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateJobSchema.parse(body);

    // Check if storage provider exists
    const db = getDatabase();
    const provider = db.prepare(
      `SELECT id FROM storage_providers WHERE id = ?`
    ).get(validatedData.storageProviderId);

    if (!provider) {
      return NextResponse.json(
        { error: "Storage provider not found" },
        { status: 400 }
      );
    }

    // Update the backup job
    db.prepare(
      `UPDATE backup_jobs 
       SET name = ?, source_path = ?, storage_provider_id = ?,
           schedule = ?, remote_path = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      validatedData.name,
      validatedData.sourcePath,
      validatedData.storageProviderId,
      validatedData.schedule,
      validatedData.remotePath,
      new Date().toISOString(),
      params.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating backup job:", error);
    return NextResponse.json(
      { error: "Failed to update backup job" },
      { status: 500 }
    );
  }
} 