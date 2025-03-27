import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import os from "os"

// Function to get log files from the logs directory
async function getLogFiles() {
  try {
    // Default logs directory path - adjust as needed for your application
    const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), "logs")
    
    try {
      await fs.access(logsDir)
    } catch {
      // Create logs directory if it doesn't exist
      await fs.mkdir(logsDir, { recursive: true })
      return []
    }
    
    const files = await fs.readdir(logsDir)
    return files
      .filter(file => file.endsWith(".log"))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file)
      }))
  } catch (error) {
    console.error("Error getting log files:", error)
    return []
  }
}

// Get specific log file content
async function getLogContent(logFile: string, limit = 1000) {
  try {
    const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), "logs")
    const filePath = path.join(logsDir, logFile)
    
    // Validate the file is within the logs directory (security check)
    const normalizedFilePath = path.normalize(filePath)
    const normalizedLogsDir = path.normalize(logsDir)
    
    if (!normalizedFilePath.startsWith(normalizedLogsDir)) {
      throw new Error("Invalid log file path")
    }
    
    const content = await fs.readFile(filePath, "utf-8")
    
    // Split by newlines, get the most recent lines up to the limit
    const lines = content.split(/\r?\n/)
    return lines.slice(-limit).join("\n")
  } catch (error) {
    console.error("Error reading log file:", error)
    throw error
  }
}

// API handler to list log files
export async function GET(request: Request) {
  try {
    // Get URL parameters
    const url = new URL(request.url)
    const fileName = url.searchParams.get("file")
    const limitParam = url.searchParams.get("limit")
    const limit = limitParam ? parseInt(limitParam, 10) : 1000
    
    // If a specific file is requested, return its content
    if (fileName) {
      const content = await getLogContent(fileName, limit)
      return NextResponse.json({ content })
    }
    
    // Otherwise, return the list of available log files
    const logFiles = await getLogFiles()
    return NextResponse.json({ files: logFiles })
  } catch (error) {
    console.error("Error in logs API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
} 