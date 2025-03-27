import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { NotificationSettings } from "@/lib/db"
import { z } from "zod"

const notificationSettingsSchema = z.object({
  onSuccess: z.boolean(),
  onFailure: z.boolean(),
  onQuotaWarning: z.boolean(),
  quotaThreshold: z.number().min(1).max(100),
})

export async function GET() {
  try {
    const db = getDatabase()

    // Get current notification settings
    const settings = db.prepare(`
      SELECT *
      FROM notification_settings
      ORDER BY id DESC
      LIMIT 1
    `).get() as NotificationSettings | undefined

    if (!settings) {
      // Return default settings if none exist
      return NextResponse.json({
        onSuccess: true,
        onFailure: true,
        onQuotaWarning: true,
        quotaThreshold: 90,
      })
    }

    return NextResponse.json({
      onSuccess: Boolean(settings.on_success),
      onFailure: Boolean(settings.on_failure),
      onQuotaWarning: Boolean(settings.on_quota_warning),
      quotaThreshold: settings.quota_threshold,
    })
  } catch (error) {
    console.error("Error fetching notification settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch notification settings" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDatabase()
    const data = await request.json()

    // Validate settings
    const validatedSettings = notificationSettingsSchema.parse(data)

    // Save settings
    db.prepare(`
      INSERT INTO notification_settings (
        on_success,
        on_failure,
        on_quota_warning,
        quota_threshold
      ) VALUES (?, ?, ?, ?)
    `).run(
      validatedSettings.onSuccess ? 1 : 0,
      validatedSettings.onFailure ? 1 : 0,
      validatedSettings.onQuotaWarning ? 1 : 0,
      validatedSettings.quotaThreshold
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving notification settings:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid notification settings", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to save notification settings" },
      { status: 500 }
    )
  }
} 