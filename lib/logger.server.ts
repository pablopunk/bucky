import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import type { LogLevel } from './logger';

// Store original console methods to avoid recursion
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

// Flag to prevent recursive logging
let isLogging = false;

// Server-side logger class that writes to files
class ServerLogger {
  private name: string;
  private logFile: string;
  private initialized: boolean = false;
  
  constructor(name: string = "app") {
    this.name = name;
    
    // Get the date for the log file name
    const date = format(new Date(), "yyyy-MM-dd");
    
    // Set up the log file path
    const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), "logs");
    
    // Ensure the logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    this.logFile = path.join(logsDir, `${name}-${date}.log`);
    this.initialized = true;
  }
  
  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss.SSS");
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (meta) {
      try {
        const metaStr = typeof meta === "string" ? meta : JSON.stringify(meta);
        formattedMessage += ` ${metaStr}`;
      } catch (error) {
        formattedMessage += ` [Unable to stringify meta data]`;
      }
    }
    
    return formattedMessage;
  }
  
  private writeToFile(message: string): void {
    if (!this.initialized) return;
    
    try {
      // Append to the log file
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      originalConsole.error('Error writing to log file:', error);
    }
  }
  
  info(message: string, meta?: any): void {
    if (isLogging) {
      originalConsole.info(message);
      return;
    }
    
    isLogging = true;
    try {
      const formattedMessage = this.formatMessage("info", message, meta);
      originalConsole.info(formattedMessage);
      this.writeToFile(formattedMessage);
    } finally {
      isLogging = false;
    }
  }
  
  warn(message: string, meta?: any): void {
    if (isLogging) {
      originalConsole.warn(message);
      return;
    }
    
    isLogging = true;
    try {
      const formattedMessage = this.formatMessage("warn", message, meta);
      originalConsole.warn(formattedMessage);
      this.writeToFile(formattedMessage);
    } finally {
      isLogging = false;
    }
  }
  
  error(message: string, meta?: any): void {
    if (isLogging) {
      originalConsole.error(message);
      return;
    }
    
    isLogging = true;
    try {
      const formattedMessage = this.formatMessage("error", message, meta);
      originalConsole.error(formattedMessage);
      this.writeToFile(formattedMessage);
    } finally {
      isLogging = false;
    }
  }
  
  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV !== "production") {
      if (isLogging) {
        originalConsole.debug(message);
        return;
      }
      
      isLogging = true;
      try {
        const formattedMessage = this.formatMessage("debug", message, meta);
        originalConsole.debug(formattedMessage);
        this.writeToFile(formattedMessage);
      } finally {
        isLogging = false;
      }
    }
  }
  
  child(name: string): ServerLogger {
    return new ServerLogger(`${this.name}-${name}`);
  }
}

// Function to initialize console interception
function setupConsoleInterception(logger: ServerLogger) {
  // Only do this once
  if ((global as any).__consoleIntercepted) return;
  (global as any).__consoleIntercepted = true;
  
  // A safer log function
  const safeLog = (level: LogLevel, args: any[]) => {
    if (isLogging) {
      originalConsole[level](...args);
      return;
    }
    
    isLogging = true;
    try {
      // Convert args to a string message
      const message = args
        .map(arg => {
          if (arg instanceof Error) return arg.stack || arg.message;
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch (e) {
              return '[Object]';
            }
          }
          return String(arg);
        })
        .join(' ');
      
      // Special handling for certain error types
      if (message.includes('Attempted import error')) {
        originalConsole[level](...args);
        try {
          logger[level](message);
        } catch {}
      } else {
        try {
          logger[level](message);
        } catch {}
      }
    } catch (e) {
      originalConsole.error('Error in console interceptor:', e);
    } finally {
      isLogging = false;
    }
  };
  
  // Override console methods
  console.log = (...args: any[]) => safeLog("info", args);
  console.info = (...args: any[]) => safeLog("info", args);
  console.warn = (...args: any[]) => safeLog("warn", args);
  console.error = (...args: any[]) => safeLog("error", args);
  console.debug = (...args: any[]) => safeLog("debug", args);
}

// Export a factory function to create the server logger
export function createServerLogger(): ServerLogger {
  const logger = new ServerLogger();
  setupConsoleInterception(logger);
  return logger;
} 