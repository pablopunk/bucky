import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const db = getDatabase()

    // Get backup statistics
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_backups,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
        AVG(duration) as avg_duration,
        SUM(size) as total_size,
        AVG(compression_ratio) as avg_compression_ratio
      FROM backup_history
      WHERE start_time >= ? AND start_time <= ?
    `).get(from || "1970-01-01", to || new Date().toISOString()) as {
      total_backups: number
      success_rate: number
      avg_duration: number
      total_size: number
      avg_compression_ratio: number
    }

    // Calculate compression savings
    const compressionSavings = stats.total_size * (1 - 1 / stats.avg_compression_ratio)

    return NextResponse.json({
      totalBackups: stats.total_backups,
      successRate: Math.round(stats.success_rate * 100) / 100,
      averageDuration: Math.round(stats.avg_duration),
      totalSize: stats.total_size,
      compressionSavings: Math.round(compressionSavings),
    })
  } catch (error) {
    console.error("Error fetching backup stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch backup statistics" },
      { status: 500 }
    )
  }
} 