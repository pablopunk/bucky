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

    // Fix common mistyping in Gmail's SMTP host
    const host = config.host.trim().toLowerCase();
    if (host === "smpt.gmail.com") {
      config.host = "smtp.gmail.com";
    } else if (host === "smtp.googlemail.com") {
      config.host = "smtp.gmail.com";
    }

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
    
    // Provide more helpful error messages for common SMTP issues
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check for common connection errors
    if (errorMessage.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { error: "Connection refused. Please check if the SMTP host and port are correct." },
        { status: 500 }
      )
    } else if (errorMessage.includes("ETIMEDOUT")) {
      return NextResponse.json(
        { error: "Connection timed out. Please check your network and SMTP server settings." },
        { status: 500 }
      )
    } else if (errorMessage.includes("ENOTFOUND")) {
      return NextResponse.json(
        { error: "Server not found. Please check if the SMTP host is correct." },
        { status: 500 }
      )
    } else if (errorMessage.includes("authentication failed") || errorMessage.includes("Invalid login")) {
      return NextResponse.json(
        { error: "Authentication failed. Please check your username and password." },
        { status: 500 }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid SMTP configuration", details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to send test email: " + errorMessage },
      { status: 500 }
    )
  }
} 