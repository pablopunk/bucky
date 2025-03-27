import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { Settings } from "@/lib/db"
import { z } from "zod"

const settingsSchema = z.object({
  dataDirectory: z.string(),
  backupDirectory: z.string(),
  maxConcurrentJobs: z.number().min(1).max(10),
  retentionPeriod: z.number().min(1),
  compressionLevel: z.number().min(0).max(9),
  enableLogging: z.boolean(),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
  autoUpdateCheck: z.boolean(),
})

export async function GET() {
  try {
    const db = getDatabase()

    // Get current settings
    const settings = db.prepare(`
      SELECT *
      FROM settings
      ORDER BY id DESC
      LIMIT 1
    `).get() as Settings | undefined

    if (!settings) {
      // Return default settings if none exist
      return NextResponse.json({
        dataDirectory: "./data",
        backupDirectory: "./backups",
        maxConcurrentJobs: 3,
        retentionPeriod: 30,
        compressionLevel: 6,
        enableLogging: true,
        logLevel: "info",
        autoUpdateCheck: true,
      })
    }

    return NextResponse.json({
      dataDirectory: settings.data_directory,
      backupDirectory: settings.backup_directory,
      maxConcurrentJobs: settings.max_concurrent_jobs,
      retentionPeriod: settings.retention_period,
      compressionLevel: settings.compression_level,
      enableLogging: settings.enable_logging,
      logLevel: settings.log_level,
      autoUpdateCheck: settings.auto_update_check,
    })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDatabase()
    const data = await request.json()

    // Validate settings
    const validatedSettings = settingsSchema.parse(data)

    // Save settings
    db.prepare(`
      INSERT INTO settings (
        data_directory,
        backup_directory,
        max_concurrent_jobs,
        retention_period,
        compression_level,
        enable_logging,
        log_level,
        auto_update_check
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validatedSettings.dataDirectory,
      validatedSettings.backupDirectory,
      validatedSettings.maxConcurrentJobs,
      validatedSettings.retentionPeriod,
      validatedSettings.compressionLevel,
      validatedSettings.enableLogging,
      validatedSettings.logLevel,
      validatedSettings.autoUpdateCheck
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving settings:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid settings", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    )
  }
} 