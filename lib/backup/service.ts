import { getDatabase } from '../db';
import type { BackupJob, StorageProvider } from '../db';
import { StorageProviderManager } from '../storage';
import type { StorageCredentials } from '../storage';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from '../crypto';

const execAsync = promisify(exec);

export class BackupService {
  async runBackup(jobId: string): Promise<void> {
    const db = getDatabase();
    
    // Get job details
    const job = db.prepare(`SELECT * FROM backup_jobs WHERE id = ?`).get(jobId) as BackupJob | undefined;
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    console.log(`Starting backup for job: ${job.name} (${jobId})`);
    
    try {
      // Get storage provider
      const storageProvider = await this.getStorageProvider(job.storage_provider_id);
      
      // Create temporary filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const tempId = randomBytes(4);
      const sourceName = basename(job.source_path);
      const tempFilename = join(tmpdir(), `${sourceName}-${timestamp}-${tempId}`);
      
      // Generate backup file depending on source type 
      const backupFilePath = await this.generateBackup(job.source_path, tempFilename, job);
      
      // Upload to storage provider
      const remotePath = `/${job.name}/${basename(backupFilePath)}`;
      await storageProvider.upload(backupFilePath, remotePath);
      
      console.log(`Backup completed for job ${jobId}, uploaded to ${remotePath}`);
      
      // Clean up temp file
      await execAsync(`rm -f ${backupFilePath}`);
      
      // Update job status
      db.prepare(`
        UPDATE backup_jobs 
        SET status = ?, last_run = ?, updated_at = ? 
        WHERE id = ?
      `).run('completed', Date.now(), Date.now(), jobId);
      
      // Insert job history record
      db.prepare(`
        INSERT INTO backup_history (
          job_id, status, completed_at, file_path, file_size
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        jobId, 
        'completed', 
        Date.now(), 
        remotePath,
        0 // TODO: Get actual file size
      );
      
      return;
    } catch (error) {
      console.error(`Backup failed for job ${jobId}:`, error);
      
      // Update job status
      db.prepare(`
        UPDATE backup_jobs 
        SET status = ?, updated_at = ? 
        WHERE id = ?
      `).run('failed', Date.now(), jobId);
      
      // Insert failure record
      db.prepare(`
        INSERT INTO backup_history (
          job_id, status, completed_at, error_message
        ) VALUES (?, ?, ?, ?)
      `).run(
        jobId, 
        'failed', 
        Date.now(), 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  }
  
  private async getStorageProvider(providerId: string) {
    const db = getDatabase();
    const provider = db.prepare(`
      SELECT * FROM storage_providers WHERE id = ?
    `).get(providerId) as StorageProvider | null;
    
    if (!provider) {
      throw new Error(`Storage provider ${providerId} not found`);
    }
    
    const manager = new StorageProviderManager();
    const config = JSON.parse(provider.config || '{}');
    
    return manager.create({
      type: provider.type as "s3" | "b2" | "storj",
      ...config
    } as StorageCredentials);
  }
  
  private async generateBackup(sourcePath: string, outputPath: string, job: BackupJob): Promise<string> {
    // Check if source is a directory or file
    const { stdout } = await execAsync(`test -d "${sourcePath}" && echo "directory" || echo "file"`);
    const isDirectory = stdout.trim() === 'directory';
    
    let backupPath: string;
    
    if (isDirectory) {
      // For directories, create a tar archive
      backupPath = `${outputPath}.tar`;
      if (job.compression_enabled) {
        backupPath += '.gz';
        await execAsync(`tar -czf "${backupPath}" -C "${sourcePath}" .`);
      } else {
        await execAsync(`tar -cf "${backupPath}" -C "${sourcePath}" .`);
      }
    } else {
      // For files, just copy or compress
      if (job.compression_enabled) {
        backupPath = `${outputPath}.gz`;
        await this.compressFile(sourcePath, backupPath, job.compression_level || 6);
      } else {
        backupPath = `${outputPath}${sourcePath.includes('.') ? '.' + sourcePath.split('.').pop() : ''}`;
        await execAsync(`cp "${sourcePath}" "${backupPath}"`);
      }
    }
    
    return backupPath;
  }
  
  private async compressFile(source: string, destination: string, level: number): Promise<void> {
    const gzip = createGzip({ level });
    const sourceStream = createReadStream(source);
    const destinationStream = createWriteStream(destination);
    
    await pipeline(sourceStream, gzip, destinationStream);
  }
} 