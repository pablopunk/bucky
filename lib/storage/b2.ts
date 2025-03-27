import * as B2 from "backblaze-b2";
import { StorageProvider, StorageCredentials, StorageProviderFactory } from "./base";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

export interface B2Credentials extends StorageCredentials {
  type: "b2";
  applicationKeyId: string;
  applicationKey: string;
  bucketId: string;
  bucketName: string;
}

export class B2StorageProvider implements StorageProvider {
  private client: B2;
  private bucketId: string;
  private bucketName: string;

  constructor(credentials: B2Credentials) {
    this.client = new B2({
      applicationKeyId: credentials.applicationKeyId,
      applicationKey: credentials.applicationKey,
    });
    this.bucketId = credentials.bucketId;
    this.bucketName = credentials.bucketName;
  }

  async upload(filePath: string, destination: string): Promise<void> {
    const fileStream = createReadStream(filePath);
    const { data: { uploadUrl, authorizationToken } } = await this.client.getUploadUrl({
      bucketId: this.bucketId,
    });

    // Convert ReadStream to Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    await this.client.uploadFile({
      uploadUrl,
      uploadAuthToken: authorizationToken,
      fileName: destination,
      data: buffer,
      mime: "application/octet-stream",
    });
  }

  async download(source: string, destination: string): Promise<void> {
    const { data: { downloadUrl } } = await this.client.getDownloadAuthorization({
      bucketId: this.bucketId,
      fileNamePrefix: source,
      validDurationInSeconds: 3600,
    });

    const response = await fetch(`${downloadUrl}/b2api/v2/b2_download_file_by_id?fileId=${source}`);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const writeStream = createWriteStream(destination);
    await pipeline(response.body as any, writeStream);
  }

  async delete(path: string): Promise<void> {
    await this.client.deleteFileVersion({
      fileId: path,
      fileName: path,
    });
  }

  async list(path: string): Promise<string[]> {
    const { data: { files } } = await this.client.listFileNames({
      bucketId: this.bucketId,
      prefix: path,
      maxFileCount: 1000,
      delimiter: "/",
      startFileName: path,
    });

    return files.map((file: { fileName: string }) => file.fileName);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.getFileInfo({
        fileId: path,
      });
      return true;
    } catch (error) {
      if ((error as any).status === 404) {
        return false;
      }
      throw error;
    }
  }
}

export class B2StorageProviderFactory implements StorageProviderFactory {
  create(credentials: StorageCredentials): StorageProvider {
    if (credentials.type !== "b2") {
      throw new Error("Invalid credentials type for B2 provider");
    }
    return new B2StorageProvider(credentials as B2Credentials);
  }
} 