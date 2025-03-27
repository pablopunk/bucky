import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { IStorageProvider, StorageInfo } from "../manager"
import { createWriteStream, createReadStream } from "fs"
import { pipeline } from "stream/promises"

interface StorjConfig {
  accessKey: string
  secretKey: string
  bucket: string
  endpoint?: string
}

export class StorjProvider implements IStorageProvider {
  private client: S3Client
  private bucket: string

  constructor(config: StorjConfig) {
    this.client = new S3Client({
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      region: "us-1", // Storj doesn't use regions the same way, but needs a value
      endpoint: config.endpoint || "https://gateway.storjshare.io",
      forcePathStyle: true, // Required for Storj
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
      throw new Error("No data received from Storj")
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
    // Similar to S3, we need to list all objects and sum their sizes
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
    })

    const response = await this.client.send(command)
    const used = (response.Contents || []).reduce((total, item) => total + (item.Size || 0), 0)

    return {
      used,
      // Storj has no fixed storage limit by default
      total: Number.MAX_SAFE_INTEGER,
    }
  }
} 