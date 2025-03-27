import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import type { SMTPConfig } from "@/lib/db";
import { z } from "zod";
import { generateUUID } from "@/lib/crypto";

const smtpConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string(),
  password: z.string(),
  fromEmail: z.string().email(),
  fromName: z.string(),
});

// Helper function to wait for a specific time
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to retry database operations
async function retryOperation<T>(operation: () => T, maxRetries = 5, delay = 200): Promise<T> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return operation();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on database lock errors
      if (error.code !== 'SQLITE_BUSY') {
        throw error;
      }
      
      console.log(`Database locked, retrying operation (attempt ${attempt + 1}/${maxRetries})`);
      await wait(delay * (attempt + 1)); // Exponential backoff
    }
  }
  
  throw lastError;
}

export async function GET() {
  try {
    const db = getDatabase();

    // Get current SMTP config with retry
    const config = await retryOperation(() => {
      return db.prepare(`
        SELECT *
        FROM smtp_config
        ORDER BY id DESC
        LIMIT 1
      `).get() as SMTPConfig | undefined;
    });

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

    try {
      await retryOperation(() => {
        // Use a transaction to prevent database locks
        db.prepare('BEGIN IMMEDIATE TRANSACTION').run();

        try {
          // Check if config already exists
          const existingConfig = db.prepare(`
            SELECT COUNT(*) as count FROM smtp_config
          `).get() as { count: number };

          if (existingConfig.count > 0) {
            // Update existing config
            db.prepare(`
              UPDATE smtp_config SET
              host = ?,
              port = ?,
              username = ?,
              password = ?,
              from_email = ?,
              from_name = ?,
              updated_at = CURRENT_TIMESTAMP
              WHERE id = (SELECT id FROM smtp_config ORDER BY id DESC LIMIT 1)
            `).run(
              validatedConfig.host,
              validatedConfig.port,
              validatedConfig.username,
              validatedConfig.password,
              validatedConfig.fromEmail,
              validatedConfig.fromName
            );

            console.log("Updated existing SMTP config");
          } else {
            // Create new config
            db.prepare(`
              INSERT INTO smtp_config (
                id,
                host,
                port,
                username,
                password,
                from_email,
                from_name,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
              generateUUID(),
              validatedConfig.host,
              validatedConfig.port,
              validatedConfig.username,
              validatedConfig.password,
              validatedConfig.fromEmail,
              validatedConfig.fromName
            );

            console.log("Created new SMTP config");
          }

          // Commit the transaction
          db.prepare('COMMIT').run();
          return true;
        } catch (error) {
          // Rollback on error
          try {
            db.prepare('ROLLBACK').run();
          } catch (rollbackError) {
            console.error("Error during rollback:", rollbackError);
          }
          throw error;
        }
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error in database operation:", error);
      throw error;
    }
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