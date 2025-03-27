import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import type { BackupHistory } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const limit = parseInt(searchParams.get("limit") || "20");

    const db = getDatabase();
    let query = `
      SELECT 
        id, job_id, status, start_time, end_time,
        duration, size, compression_ratio, message,
        created_at
      FROM backup_history
    `;
    const params: any[] = [];

    if (jobId) {
      query += " WHERE job_id = ?";
      params.push(jobId);
    }

    query += " ORDER BY start_time DESC LIMIT ?";
    params.push(limit);

    const history = db.prepare(query).all(...params) as BackupHistory[];

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching backup history:", error);
    return NextResponse.json(
      { error: "Failed to fetch backup history" },
      { status: 500 }
    );
  }
} 