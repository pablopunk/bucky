import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { NotificationSettings } from "@/lib/db"
import { z } from "zod"
import crypto from "crypto"

const notificationSettingsSchema = z.object({
  onSuccess: z.boolean(),
  onFailure: z.boolean(),
  email: z.string().email().optional(),
})

export async function GET() {
  try {
    const db = getDatabase()

    // Get current notification settings
    const settings = db.prepare(`
      SELECT email, on_success, on_failure
      FROM notification_settings
      LIMIT 1
    `).get() as NotificationSettings | undefined

    if (!settings) {
      // Return default settings if none exist
      return NextResponse.json({
        onSuccess: true,
        onFailure: true,
        email: ""
      })
    }

    return NextResponse.json({
      onSuccess: Boolean(settings.on_success),
      onFailure: Boolean(settings.on_failure),
      email: settings.email || ""
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

    // Check if settings already exist
    const existingSettings = db.prepare('SELECT COUNT(*) as count FROM notification_settings').get() as { count: number };
    
    if (existingSettings.count > 0) {
      // Update existing settings
      db.prepare(`
        UPDATE notification_settings SET
        email = ?,
        on_success = ?,
        on_failure = ?,
        updated_at = CURRENT_TIMESTAMP
      `).run(
        validatedSettings.email || "",
        validatedSettings.onSuccess ? 1 : 0,
        validatedSettings.onFailure ? 1 : 0
      )
    } else {
      // Insert new settings
      db.prepare(`
        INSERT INTO notification_settings (
          id,
          email,
          on_success,
          on_failure
        ) VALUES (?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        validatedSettings.email || "",
        validatedSettings.onSuccess ? 1 : 0,
        validatedSettings.onFailure ? 1 : 0
      )
    }

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