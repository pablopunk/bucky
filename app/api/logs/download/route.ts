import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

export async function GET(request: Request) {
  try {
    // Get URL parameters
    const url = new URL(request.url)
    const fileName = url.searchParams.get("file")
    
    if (!fileName) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      )
    }
    
    // Get the log file path
    const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), "logs")
    const filePath = path.join(logsDir, fileName)
    
    // Validate the file is within the logs directory (security check)
    const normalizedFilePath = path.normalize(filePath)
    const normalizedLogsDir = path.normalize(logsDir)
    
    if (!normalizedFilePath.startsWith(normalizedLogsDir)) {
      return NextResponse.json(
        { error: "Invalid log file path" },
        { status: 400 }
      )
    }
    
    try {
      // Check if file exists
      await fs.access(filePath)
    } catch {
      return NextResponse.json(
        { error: "Log file not found" },
        { status: 404 }
      )
    }
    
    // Read the entire file
    const fileContent = await fs.readFile(filePath, "utf-8")
    
    // Create response with appropriate headers for download
    const response = new NextResponse(fileContent)
    response.headers.set("Content-Disposition", `attachment; filename=${fileName}`)
    response.headers.set("Content-Type", "text/plain")
    
    return response
  } catch (error) {
    console.error("Error downloading log file:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
} 