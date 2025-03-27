import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import type { BackupHistory } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    const db = getDatabase();
    
    let query = `
      SELECT 
        h.id,
        h.job_id,
        j.name as job_name,
        h.status,
        h.start_time,
        h.end_time,
        h.size,
        h.message,
        h.created_at
      FROM backup_history h
      LEFT JOIN backup_jobs j ON h.job_id = j.id
    `;
    
    // If jobId is provided, filter by that job
    if (jobId) {
      query += ` WHERE h.job_id = ?`;
    }
    
    query += ` ORDER BY h.created_at DESC LIMIT 10`;
    
    let history;
    if (jobId) {
      history = db.prepare(query).all(jobId) as (BackupHistory & { job_name: string })[];
    } else {
      history = db.prepare(query).all() as (BackupHistory & { job_name: string })[];
    }

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching backup history:", error);
    return NextResponse.json(
      { error: "Failed to fetch backup history" },
      { status: 500 }
    );
  }
} 