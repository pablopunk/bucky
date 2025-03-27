import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import os from "os"

// Function to get log files from the logs directory
async function getLogFiles(includeStats = false) {
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
    const logFiles = files.filter(file => file.endsWith(".log"))
    
    if (!includeStats) {
      return logFiles.map(file => ({
        name: file,
        path: path.join(logsDir, file)
      }))
    }
    
    // Get file stats if requested
    const filesWithStats = await Promise.all(
      logFiles.map(async (file) => {
        const filePath = path.join(logsDir, file)
        const stats = await fs.stat(filePath)
        const fileContent = stats.size > 0 
          ? await fs.readFile(filePath, "utf-8")
          : ""
          
        return {
          name: file,
          path: filePath,
          size: stats.size,
          isEmpty: stats.size === 0 || !fileContent.trim(),
          lastModified: stats.mtime
        }
      })
    )
    
    // Sort by newest first
    return filesWithStats.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
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
    
    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return ""
    }
    
    const stats = await fs.stat(filePath)
    if (stats.size === 0) {
      return ""
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
    const includeStats = url.searchParams.get("includeStats") === "true"
    const limit = limitParam ? parseInt(limitParam, 10) : 1000
    
    // If a specific file is requested, return its content
    if (fileName) {
      const content = await getLogContent(fileName, limit)
      return NextResponse.json({ content })
    }
    
    // Otherwise, return the list of available log files
    const logFiles = await getLogFiles(includeStats)
    return NextResponse.json({ files: logFiles })
  } catch (error) {
    console.error("Error in logs API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
} 