export interface StorageCredentials {
  type: "s3" | "b2" | "storj";
  [key: string]: any;
}

export interface StorageProvider {
  upload(filePath: string, destination: string): Promise<void>;
  download(source: string, destination: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

export interface StorageProviderFactory {
  create(credentials: StorageCredentials): StorageProvider;
} 