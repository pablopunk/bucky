import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { StorageProvider, StorageCredentials, StorageProviderFactory } from "./base";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { promises as fs } from "fs";

export interface StorjCredentials extends StorageCredentials {
  type: "storj";
  accessKey: string;      // S3 Access Key from Storj
  secretKey: string;      // S3 Secret Key from Storj
  bucket: string;         // Bucket name in Storj
  endpoint?: string;      // Optional custom endpoint
}

export class StorjStorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor(credentials: StorjCredentials) {
    if (!credentials.accessKey || !credentials.secretKey || !credentials.bucket) {
      throw new Error("Missing required Storj credentials");
    }

    this.bucket = credentials.bucket;
    this.client = new S3Client({
      region: "us-1",
      endpoint: credentials.endpoint || "https://gateway.storjshare.io",
      credentials: {
        accessKeyId: credentials.accessKey,
        secretAccessKey: credentials.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async upload(filePath: string, destinationPath: string): Promise<void> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
        Body: fileBuffer,
        ContentType: 'application/octet-stream',
      });

      await this.client.send(command);
    } catch (error) {
      console.error("Storj upload error:", error);
      throw new Error(`Failed to upload to Storj: ${(error as Error).message}`);
    }
  }

  async download(source: string, destination: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: source,
    });

    const response = await this.client.send(command);
    const writeStream = createWriteStream(destination);
    
    if (!response.Body) {
      throw new Error("No data received from Storj");
    }

    await pipeline(response.Body as any, writeStream);
  }

  async delete(path: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    await this.client.send(command);
  }

  async list(path: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: path,
    });

    const response = await this.client.send(command);
    return (response.Contents || []).map(item => item.Key || "");
  }

  async exists(path: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if ((error as any).name === "NoSuchKey") {
        return false;
      }
      throw error;
    }
  }
}

export class StorjStorageProviderFactory implements StorageProviderFactory {
  create(credentials: StorageCredentials): StorageProvider {
    if (credentials.type !== "storj") {
      throw new Error("Invalid credentials type for Storj provider");
    }
    return new StorjStorageProvider(credentials as StorjCredentials);
  }
} 