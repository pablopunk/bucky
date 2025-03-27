import { B2 } from "backblaze-b2"
import { IStorageProvider, StorageInfo } from "../manager"
import { createWriteStream, createReadStream } from "fs"
import { pipeline } from "stream/promises"

interface B2Config {
  applicationKeyId: string
  applicationKey: string
  bucket: string
}

export class B2Provider implements IStorageProvider {
  private client: B2
  private bucket: string
  private bucketId: string | null = null

  constructor(config: B2Config) {
    this.client = new B2({
      applicationKeyId: config.applicationKeyId,
      applicationKey: config.applicationKey,
    })
    this.bucket = config.bucket
  }

  private async getBucketId(): Promise<string> {
    if (this.bucketId) return this.bucketId

    await this.client.authorize()
    const response = await this.client.getBucket({ bucketName: this.bucket })
    this.bucketId = response.data.buckets[0].bucketId
    return this.bucketId
  }

  async upload(sourcePath: string, destinationPath: string): Promise<void> {
    await this.client.authorize()
    const bucketId = await this.getBucketId()

    // Get upload URL
    const uploadUrlResponse = await this.client.getUploadUrl({
      bucketId,
    })

    // Read file
    const fileStream = createReadStream(sourcePath)
    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      fileStream.on("data", (chunk) => chunks.push(chunk))
      fileStream.on("end", () => resolve(Buffer.concat(chunks)))
      fileStream.on("error", reject)
    })

    // Upload file
    await this.client.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: destinationPath,
      data: fileBuffer,
    })
  }

  async download(sourcePath: string, destinationPath: string): Promise<void> {
    await this.client.authorize()

    // Get file info
    const fileInfo = await this.client.getFileInfo({
      fileName: sourcePath,
      bucketName: this.bucket,
    })

    // Download file
    const response = await this.client.downloadFileById({
      fileId: fileInfo.data.fileId,
    })

    // Write to destination
    const fileStream = createWriteStream(destinationPath)
    await pipeline(response.data, fileStream)
  }

  async delete(path: string): Promise<void> {
    await this.client.authorize()

    // Get file info
    const fileInfo = await this.client.getFileInfo({
      fileName: path,
      bucketName: this.bucket,
    })

    // Delete file
    await this.client.deleteFileVersion({
      fileId: fileInfo.data.fileId,
      fileName: path,
    })
  }

  async list(path: string): Promise<string[]> {
    await this.client.authorize()

    const response = await this.client.listFileNames({
      bucketId: await this.getBucketId(),
      prefix: path,
    })

    return response.data.files.map((file) => file.fileName)
  }

  async getStorageInfo(): Promise<StorageInfo> {
    await this.client.authorize()
    const bucketId = await this.getBucketId()

    // List all files to calculate total size
    const response = await this.client.listFileNames({
      bucketId,
    })

    const used = response.data.files.reduce((total, file) => total + file.contentLength, 0)

    return {
      used,
      // B2 doesn't have a fixed storage limit
      total: Number.MAX_SAFE_INTEGER,
    }
  }
} 