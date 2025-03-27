import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { StorageProvider, StorageCredentials, StorageProviderFactory } from "./base";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { _Object } from "@aws-sdk/client-s3";

export interface S3Credentials extends StorageCredentials {
  type: "s3";
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string; // For custom endpoints like MinIO
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor(credentials: S3Credentials) {
    this.client = new S3Client({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      ...(credentials.endpoint && { endpoint: credentials.endpoint }),
    });
    this.bucket = credentials.bucket;
  }

  async upload(filePath: string, destination: string): Promise<void> {
    const fileStream = createReadStream(filePath);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: destination,
      Body: fileStream,
    });

    await this.client.send(command);
  }

  async download(source: string, destination: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: source,
    });

    const response = await this.client.send(command);
    const writeStream = createWriteStream(destination);
    
    if (!response.Body) {
      throw new Error("No data received from S3");
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
    return (response.Contents || []).map((item: _Object) => item.Key || "");
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

export class S3StorageProviderFactory implements StorageProviderFactory {
  create(credentials: StorageCredentials): StorageProvider {
    if (credentials.type !== "s3") {
      throw new Error("Invalid credentials type for S3 provider");
    }
    return new S3StorageProvider(credentials as S3Credentials);
  }
} 