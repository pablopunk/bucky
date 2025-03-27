import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"

/**
 * Health check endpoint for monitoring the application status
 * Used by Docker health checks and monitoring tools
 */
export async function GET() {
  try {
    // Check database connection
    const db = getDatabase()
    
    // Simple query to ensure database is working
    db.prepare("SELECT 1").get()
    
    // Return healthy status
    return NextResponse.json(
      { 
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "unknown"
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Health check failed:", error)
    
    // Return unhealthy status
    return NextResponse.json(
      { 
        status: "unhealthy", 
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 