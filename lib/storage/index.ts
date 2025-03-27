import { StorageProvider, StorageCredentials, StorageProviderFactory } from "./base";
import { S3StorageProviderFactory } from "./s3";
import { B2StorageProviderFactory } from "./b2";
import { StorjStorageProviderFactory } from "./storj";

export class StorageProviderManager implements StorageProviderFactory {
  private factories: Map<string, StorageProviderFactory>;

  constructor() {
    this.factories = new Map([
      ["s3", new S3StorageProviderFactory()],
      ["b2", new B2StorageProviderFactory()],
      ["storj", new StorjStorageProviderFactory()],
    ]);
  }

  create(credentials: StorageCredentials): StorageProvider {
    const factory = this.factories.get(credentials.type);
    if (!factory) {
      throw new Error(`Unsupported storage provider type: ${credentials.type}`);
    }
    return factory.create(credentials);
  }
}

export * from "./base";
export * from "./s3";
export * from "./b2";
export * from "./storj"; 