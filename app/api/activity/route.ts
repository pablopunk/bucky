import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { BackupHistory } from "@/lib/db"

export async function GET() {
  try {
    const db = getDatabase()

    // Get recent activity
    const activity = db.prepare(`
      SELECT 
        id,
        job_id as jobId,
        status,
        message,
        start_time as timestamp
      FROM backup_history
      ORDER BY start_time DESC
      LIMIT 20
    `).all() as BackupHistory[]

    // Format the activity data
    const formattedActivity = activity.map((item) => ({
      id: item.id,
      jobName: "Job " + item.job_id, // TODO: Join with jobs table to get name
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