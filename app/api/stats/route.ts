import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

export async function GET() {
  try {
    const db = getDatabase()

    // Get total jobs count and their status
    const jobStats = db.prepare(`
      SELECT 
        COUNT(*) as totalJobs,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeJobs,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as pausedJobs
      FROM backup_jobs
    `).get() as { totalJobs: number; activeJobs: number; pausedJobs: number }

    // Calculate date for week comparison
    const today = new Date()
    const oneWeekAgo = new Date(today)
    oneWeekAgo.setDate(today.getDate() - 7)
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(today.getDate() - 14)
    
    const oneWeekAgoStr = oneWeekAgo.toISOString()
    const twoWeeksAgoStr = twoWeeksAgo.toISOString()

    // Get current week stats
    const currentWeekStats = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successfulBackups,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedBackups
      FROM backup_history
      WHERE start_time >= ?
    `).get(oneWeekAgoStr) as { successfulBackups: number; failedBackups: number }

    // Get previous week stats
    const previousWeekStats = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successfulBackups,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedBackups
      FROM backup_history
      WHERE start_time >= ? AND start_time < ?
    `).get(twoWeeksAgoStr, oneWeekAgoStr) as { successfulBackups: number; failedBackups: number }

    // Calculate percentage changes
    const successPercentChange = calculatePercentChange(
      previousWeekStats.successfulBackups || 0,
      currentWeekStats.successfulBackups || 0
    )
    
    const failedPercentChange = calculatePercentChange(
      previousWeekStats.failedBackups || 0,
      currentWeekStats.failedBackups || 0
    )

    // Get total backup stats
    const backupStats = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successfulBackups,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedBackups
      FROM backup_history
    `).get() as { successfulBackups: number; failedBackups: number }

    // Get next scheduled backup
    const nextScheduled = db.prepare(`
      SELECT 
        name as jobName,
        next_run as time
      FROM backup_jobs
      WHERE status = 'active' AND next_run IS NOT NULL
      ORDER BY next_run ASC
      LIMIT 1
    `).get() as { jobName: string; time: string } || { jobName: "", time: "" }

    return NextResponse.json({
      totalJobs: jobStats.totalJobs || 0,
      activeJobs: jobStats.activeJobs || 0,
      pausedJobs: jobStats.pausedJobs || 0,
      successfulBackups: backupStats.successfulBackups || 0,
      failedBackups: backupStats.failedBackups || 0,
      successPercentChange,
      failedPercentChange,
      nextScheduled,
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    )
  }
}

// Helper function to calculate percentage change
function calculatePercentChange(previous: number, current: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return Math.round(((current - previous) / previous) * 100)
} 