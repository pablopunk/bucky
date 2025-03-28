import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse rclone output to extract the transferred size in bytes
 * @param output - The stdout from rclone command
 * @returns The size in bytes
 */
export function parseRcloneSize(output: string): number {
  // First try to match the "Transferred: X.XX Unit" format (newer rclone versions)
  const sizeMatch = output.match(/Transferred:\s+([\d.]+)\s+([KMGTPEZYkB]+)/i);
  
  if (sizeMatch) {
    const value = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toUpperCase();
    
    // Convert to bytes based on unit
    if (unit === 'B' || unit === 'BYTES') return value;
    if (unit === 'KB' || unit === 'K') return value * 1024;
    if (unit === 'MB' || unit === 'M') return value * 1024 * 1024;
    if (unit === 'GB' || unit === 'G') return value * 1024 * 1024 * 1024;
    if (unit === 'TB' || unit === 'T') return value * 1024 * 1024 * 1024 * 1024;
    if (unit === 'PB' || unit === 'P') return value * 1024 * 1024 * 1024 * 1024 * 1024;
  }
  
  // Try alternative format "Transferred: X Bytes (Y%)"
  const bytesMatch = output.match(/Transferred:\s+([\d,]+)\s+Bytes/i);
  if (bytesMatch) {
    // Remove commas and parse as int
    return parseInt(bytesMatch[1].replace(/,/g, ''), 10);
  }
  
  // Try to find any number followed by bytes/KB/MB/GB in the output
  const fallbackMatch = output.match(/(\d+(\.\d+)?)\s*(bytes|KB|MB|GB|TB)/i);
  if (fallbackMatch) {
    const value = parseFloat(fallbackMatch[1]);
    const unit = fallbackMatch[3].toUpperCase();
    
    if (unit === 'BYTES') return value;
    if (unit === 'KB') return value * 1024;
    if (unit === 'MB') return value * 1024 * 1024;
    if (unit === 'GB') return value * 1024 * 1024 * 1024;
    if (unit === 'TB') return value * 1024 * 1024 * 1024 * 1024;
  }
  
  // Default to 0 if no match found
  return 0;
}

/**
 * Format bytes to human-readable size with appropriate unit
 * @param bytes - The size in bytes
 * @param decimals - Number of decimal places
 * @returns Formatted string with appropriate unit (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (isNaN(bytes) || !isFinite(bytes)) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  // Calculate the appropriate unit
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  // Format with the appropriate unit
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
