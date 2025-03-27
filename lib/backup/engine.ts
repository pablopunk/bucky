import { StorageProvider } from "../storage";
import { createReadStream, createWriteStream, statSync, mkdirSync, existsSync, readdirSync } from "fs";
import { readFile } from "fs/promises";
import { pipeline } from "stream/promises";
import { createHash } from "crypto";
import { join, basename, dirname, relative } from "path";
import { BackupJob } from "../db";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface BackupResult {
  success: boolean;
  error?: string;
  size: number;
  path: string;
  hash: string;
}

export class BackupEngine {
  constructor(private storageProvider: StorageProvider) {}

  private async uploadDirectory(localPath: string, remoteBasePath: string, sourceParent: string): Promise<{ totalSize: number; totalHash: string }> {
    const hash = createHash("sha256");
    let totalSize = 0;

    const files = readdirSync(localPath, { withFileTypes: true });
    
    for (const file of files) {
      const localFilePath = join(localPath, file.name);
      const relativePath = relative(sourceParent, localFilePath);
      const remotePath = join(remoteBasePath, relativePath).replace(/\\/g, '/');

      if (file.isDirectory()) {
        // Recursively upload directories
        const result = await this.uploadDirectory(localFilePath, remoteBasePath, sourceParent);
        totalSize += result.totalSize;
        hash.update(result.totalHash);
      } else {
        // Upload files
        const fileContent = await readFile(localFilePath);
        const fileHash = createHash("sha256");
        fileHash.update(fileContent);
        const fileHashHex = fileHash.digest("hex");
        
        await this.storageProvider.upload(localFilePath, remotePath);
        
        const stats = statSync(localFilePath);
        totalSize += stats.size;
        hash.update(fileHashHex);
      }
    }

    return {
      totalSize,
      totalHash: hash.digest("hex")
    };
  }

  async createBackup(job: BackupJob): Promise<BackupResult> {
    try {
      // Get the parent directory of the source path
      const sourceParent = dirname(job.source_path);
      // Upload the entire directory structure directly under the remote path
      const { totalSize, totalHash } = await this.uploadDirectory(
        job.source_path,
        job.remote_path,
        sourceParent
      );

      return {
        success: true,
        size: totalSize,
        path: job.remote_path,
        hash: totalHash,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        size: 0,
        path: job.remote_path,
        hash: "",
      };
    }
  }

  async restoreBackup(backupPath: string, destination: string): Promise<BackupResult> {
    try {
      // Create destination directory if it doesn't exist
      if (!existsSync(destination)) {
        mkdirSync(destination, { recursive: true });
      }

      // List all files in the backup
      const files = await this.storageProvider.list(backupPath);
      
      // Download each file
      for (const file of files) {
        const localPath = join(destination, relative(backupPath, file));
        const dir = dirname(localPath);
        
        // Create directory if it doesn't exist
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        // Download the file
        await this.storageProvider.download(file, localPath);
      }

      // Calculate total size and hash
      let totalSize = 0;
      const hash = createHash("sha256");

      for (const file of files) {
        const localPath = join(destination, relative(backupPath, file));
        const fileContent = await readFile(localPath);
        const fileHash = createHash("sha256");
        fileHash.update(fileContent);
        hash.update(fileHash.digest("hex"));
        
        const stats = statSync(localPath);
        totalSize += stats.size;
      }

      return {
        success: true,
        size: totalSize,
        path: backupPath,
        hash: hash.digest("hex"),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        size: 0,
        path: backupPath,
        hash: "",
      };
    }
  }

  async listBackups(jobName: string): Promise<string[]> {
    return this.storageProvider.list(jobName);
  }

  async deleteBackup(path: string): Promise<boolean> {
    try {
      await this.storageProvider.delete(path);
      return true;
    } catch (error) {
      return false;
    }
  }
} 