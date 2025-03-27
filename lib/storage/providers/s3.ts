import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { IStorageProvider, StorageInfo } from "../manager"
import { createWriteStream, createReadStream } from "fs"
import { pipeline } from "stream/promises"

interface S3Config {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  region: string
  endpoint?: string
}

export class S3Provider implements IStorageProvider {
  private client: S3Client
  private bucket: string

  constructor(config: S3Config) {
    this.client = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      region: config.region,
      endpoint: config.endpoint,
    })
    this.bucket = config.bucket
  }

  async upload(sourcePath: string, destinationPath: string): Promise<void> {
    const fileStream = createReadStream(sourcePath)
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: destinationPath,
      Body: fileStream,
    })

    await this.client.send(command)
  }

  async download(sourcePath: string, destinationPath: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: sourcePath,
    })

    const response = await this.client.send(command)
    if (!response.Body) {
      throw new Error("No data received from S3")
    }

    const fileStream = createWriteStream(destinationPath)
    await pipeline(response.Body as NodeJS.ReadableStream, fileStream)
  }

  async delete(path: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: path,
    })

    await this.client.send(command)
  }

  async list(path: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: path,
    })

    const response = await this.client.send(command)
    return (response.Contents || []).map((item) => item.Key || "").filter(Boolean)
  }

  async getStorageInfo(): Promise<StorageInfo> {
    // S3 doesn't have a direct way to get storage info
    // We'll need to list all objects and sum their sizes
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
    })

    const response = await this.client.send(command)
    const used = (response.Contents || []).reduce((total, item) => total + (item.Size || 0), 0)

    return {
      used,
      // S3 has no storage limit by default
      total: Number.MAX_SAFE_INTEGER,
    }
  }
} 