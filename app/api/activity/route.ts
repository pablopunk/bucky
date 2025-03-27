import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { BackupHistory } from "@/lib/db"

export async function GET() {
  try {
    const db = getDatabase()

    // Get recent activity
    const activity = db.prepare(`
      SELECT 
        h.id,
        h.job_id as jobId,
        j.name as jobName,
        h.status,
        h.message,
        h.start_time
      FROM backup_history h
      LEFT JOIN backup_jobs j ON h.job_id = j.id
      ORDER BY h.start_time DESC
      LIMIT 20
    `).all() as (BackupHistory & { jobName: string })[]

    // Format the activity data
    const formattedActivity = activity.map((item) => ({
      id: item.id,
      jobName: item.jobName || "Unknown Job",
      status: item.status as "success" | "failed" | "running",
      message: item.message || "",
      timestamp: item.start_time,
    }))

    return NextResponse.json(formattedActivity)
  } catch (error) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    )
  }
} 