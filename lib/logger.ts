import fs from "fs"
import path from "path"
import { format } from "date-fns"

// Ensure logs directory exists
const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), "logs")
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Log types
export type LogLevel = "info" | "warn" | "error" | "debug"

// Logger class
class Logger {
  private logFile: string
  private stream: fs.WriteStream | null = null
  
  constructor(name: string = "app") {
    // Create a log file for each day
    const date = format(new Date(), "yyyy-MM-dd")
    this.logFile = path.join(logsDir, `${name}-${date}.log`)
    
    // Create or open the log file
    this.initStream()
  }
  
  private initStream() {
    try {
      this.stream = fs.createWriteStream(this.logFile, { flags: "a" })
    } catch (error) {
      console.error("Failed to initialize log stream:", error)
    }
  }
  
  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss.SSS")
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    
    if (meta) {
      try {
        const metaStr = typeof meta === "string" ? meta : JSON.stringify(meta)
        formattedMessage += ` ${metaStr}`
      } catch (error) {
        formattedMessage += ` [Unable to stringify meta data]`
      }
    }
    
    return formattedMessage
  }
  
  log(level: LogLevel, message: string, meta?: any) {
    if (!this.stream) {
      this.initStream()
    }
    
    const formattedMessage = this.formatMessage(level, message, meta)
    
    // Write to console
    console[level](formattedMessage)
    
    // Write to file
    if (this.stream) {
      this.stream.write(`${formattedMessage}\n`)
    }
  }
  
  info(message: string, meta?: any) {
    this.log("info", message, meta)
  }
  
  warn(message: string, meta?: any) {
    this.log("warn", message, meta)
  }
  
  error(message: string, meta?: any) {
    this.log("error", message, meta)
  }
  
  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== "production") {
      this.log("debug", message, meta)
    }
  }
  
  // Create a specialized logger for a component
  child(name: string) {
    return new Logger(name)
  }
  
  // For clean shutdown
  close() {
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }
  }
}

// Create the default app logger
const logger = new Logger()

// Create specific loggers for different components
export const jobLogger = logger.child("jobs")
export const storageLogger = logger.child("storage")
export const apiLogger = logger.child("api")

export default logger 