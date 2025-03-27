import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import type { SMTPConfig } from "@/lib/db";
import { z } from "zod";

const smtpConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string(),
  password: z.string(),
  fromEmail: z.string().email(),
  fromName: z.string(),
});

export async function GET() {
  try {
    const db = getDatabase();

    // Get current SMTP config
    const config = db.prepare(`
      SELECT *
      FROM smtp_config
      ORDER BY id DESC
      LIMIT 1
    `).get() as SMTPConfig | undefined;

    if (!config) {
      // Return empty config if none exists
      return NextResponse.json({
        host: "",
        port: 587,
        username: "",
        password: "",
        fromEmail: "",
        fromName: "",
      });
    }

    return NextResponse.json({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      fromEmail: config.from_email,
      fromName: config.from_name,
    });
  } catch (error) {
    console.error("Error fetching SMTP config:", error);
    return NextResponse.json(
      { error: "Failed to fetch SMTP configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = getDatabase();
    const data = await request.json();

    // Validate config
    const validatedConfig = smtpConfigSchema.parse(data);

    // Save config
    db.prepare(`
      INSERT INTO smtp_config (
        host,
        port,
        username,
        password,
        from_email,
        from_name
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      validatedConfig.host,
      validatedConfig.port,
      validatedConfig.username,
      validatedConfig.password,
      validatedConfig.fromEmail,
      validatedConfig.fromName
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving SMTP config:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid SMTP configuration", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save SMTP configuration" },
      { status: 500 }
    );
  }
} 