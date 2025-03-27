// Use dynamic imports for Node.js modules to be compatible with Next.js
import { format } from "date-fns"

// Log types
export type LogLevel = "info" | "warn" | "error" | "debug"

// Logger interface that both client and server implementations will follow
interface ILogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  child(name: string): ILogger;
}

// Base logger functionality
class BaseLogger implements ILogger {
  protected name: string;
  
  constructor(name: string = "app") {
    this.name = name;
  }
  
  protected formatMessage(level: LogLevel, message: string, meta?: any): string {
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
  
  info(message: string, meta?: any): void {
    console.info(this.formatMessage("info", message, meta));
  }
  
  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage("warn", message, meta));
  }
  
  error(message: string, meta?: any): void {
    console.error(this.formatMessage("error", message, meta));
  }
  
  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatMessage("debug", message, meta));
    }
  }
  
  child(name: string): ILogger {
    // This will be overridden by the specific implementations
    return new BaseLogger(name);
  }
}

// Client-side logger (simple console output only)
class ClientLogger extends BaseLogger {
  child(name: string): ILogger {
    return new ClientLogger(name);
  }
}

// Create loggers based on environment
let logger: ILogger;
let apiLogger: ILogger;
let jobLogger: ILogger;
let storageLogger: ILogger;

// We need to use this pattern to avoid Next.js bundling the server-side code
if (typeof window === 'undefined') {
  // Only import server-side logger on the server
  const { createServerLogger } = require('./logger.server');
  logger = createServerLogger();
  apiLogger = logger.child("api");
  jobLogger = logger.child("jobs");
  storageLogger = logger.child("storage");
} else {
  // Use client logger in the browser
  logger = new ClientLogger();
  apiLogger = logger.child("api");
  jobLogger = logger.child("jobs");
  storageLogger = logger.child("storage");
}

export { apiLogger, jobLogger, storageLogger };
export default logger; 