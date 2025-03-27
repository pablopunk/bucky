import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const db = getDatabase()
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    // Get backup reports with job details
    const query = `
      SELECT 
        h.id,
        j.name as jobName,
        h.status,
        h.start_time as startTime,
        h.end_time as endTime,
        h.duration,
        h.size,
        h.compression_ratio as compressionRatio
      FROM backup_history h
      JOIN backup_jobs j ON h.job_id = j.id
      WHERE h.start_time >= ? AND h.start_time <= ?
      ORDER BY h.start_time DESC
    `

    const reports = await db.all(query, [from, to])

    return NextResponse.json(reports)
  } catch (error) {
    console.error("Error fetching backup reports:", error)
    return NextResponse.json(
      { error: "Failed to fetch backup reports" },
      { status: 500 }
    )
  }
} 