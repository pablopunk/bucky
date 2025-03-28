import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import type { BackupHistory } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    const db = getDatabase();
    
    let query = `
      SELECT 
        h.id,
        h.job_id,
        j.name as job_name,
        h.status,
        h.start_time,
        h.end_time,
        h.size,
        h.message,
        h.created_at
      FROM backup_history h
      LEFT JOIN backup_jobs j ON h.job_id = j.id
    `;
    
    // If jobId is provided, filter by that job
    if (jobId) {
      query += ` WHERE h.job_id = ?`;
    }
    
    query += ` ORDER BY h.created_at DESC LIMIT 10`;
    
    let history;
    if (jobId) {
      history = db.prepare(query).all(jobId) as (BackupHistory & { job_name: string })[];
    } else {
      history = db.prepare(query).all() as (BackupHistory & { job_name: string })[];
    }

    // Process the history records to ensure numeric size values
    const processedHistory = history.map(record => {
      // Parse size to number if it's stored as string
      if (record.size !== null) {
        // Try to parse as a number first (newer records)
        const numericSize = Number(record.size);
        if (!isNaN(numericSize)) {
          record.size = numericSize;
        } else {
          // For older records that might have text like "1.5 MB", extract the number
          // and convert to bytes
          const sizeMatch = String(record.size).match(/^([\d.]+)\s*([KMGTPEZYkB]+)/i);
          if (sizeMatch) {
            const value = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2].toUpperCase();
            
            if (unit === 'B' || unit === 'BYTES') record.size = value;
            else if (unit === 'KB' || unit === 'K') record.size = value * 1024;
            else if (unit === 'MB' || unit === 'M') record.size = value * 1024 * 1024;
            else if (unit === 'GB' || unit === 'G') record.size = value * 1024 * 1024 * 1024;
            else if (unit === 'TB' || unit === 'T') record.size = value * 1024 * 1024 * 1024 * 1024;
            else record.size = 0;
          } else {
            // If no pattern match, default to 0
            record.size = 0;
          }
        }
      }
      return record;
    });

    return NextResponse.json(processedHistory);
  } catch (error) {
    console.error("Error fetching backup history:", error);
    return NextResponse.json(
      { error: "Failed to fetch backup history" },
      { status: 500 }
    );
  }
} 