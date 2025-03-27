import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"
import { z } from "zod"

const smtpConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string(),
  password: z.string(),
  fromEmail: z.string().email(),
  fromName: z.string(),
})

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate SMTP configuration
    const config = smtpConfigSchema.parse(data)

    // Send test email
    await sendEmail({
      to: config.fromEmail,
      subject: "Test Email from Bucky",
      text: "This is a test email to verify your SMTP configuration.",
      html: `
        <h1>Test Email from Bucky</h1>
        <p>This is a test email to verify your SMTP configuration.</p>
        <p>If you received this email, your SMTP settings are configured correctly.</p>
      `,
      smtpConfig: {
        host: config.host,
        port: config.port,
        auth: {
          user: config.username,
          pass: config.password,
        },
        from: `${config.fromName} <${config.fromEmail}>`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error testing SMTP configuration:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid SMTP configuration", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    )
  }
} 