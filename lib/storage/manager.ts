import { S3Provider } from "./providers/s3"
import { B2Provider } from "./providers/b2"
import { StorjProvider } from "./providers/storj"
import { getDatabase } from "@/lib/db"

export interface StorageProvider {
  id: string
  name: string
  type: string
  config: string
  status: string
  created_at: string
  updated_at: string
}

export interface StorageInfo {
  used: number
  total: number
}

export interface IStorageProvider {
  upload(sourcePath: string, destinationPath: string): Promise<void>
  download(sourcePath: string, destinationPath: string): Promise<void>
  delete(path: string): Promise<void>
  list(path: string): Promise<string[]>
  getStorageInfo(): Promise<StorageInfo>
}

export class StorageProviderManager {
  private providers: Map<string, IStorageProvider> = new Map()

  async getProvider(providerId: string): Promise<IStorageProvider> {
    // Check if provider is already instantiated
    const existingProvider = this.providers.get(providerId)
    if (existingProvider) {
      return existingProvider
    }

    // Get provider details from database
    const db = getDatabase()
    const provider = await db.query<StorageProvider>("SELECT * FROM storage_providers WHERE id = ?").get(providerId)

    if (!provider) {
      throw new Error(`Storage provider not found: ${providerId}`)
    }

    // Create new provider instance
    const newProvider = this.createProvider(provider)
    this.providers.set(providerId, newProvider)
    return newProvider
  }

  private createProvider(provider: StorageProvider): IStorageProvider {
    const config = JSON.parse(provider.config)

    switch (provider.type) {
      case "s3":
        return new S3Provider(config)
      case "b2":
        return new B2Provider(config)
      case "storj":
        return new StorjProvider(config)
      default:
        throw new Error(`Unsupported storage provider type: ${provider.type}`)
    }
  }

  async createStorageProvider(
    name: string,
    type: string,
    config: Record<string, unknown>
  ): Promise<string> {
    const db = getDatabase()

    // Validate provider type
    if (!["s3", "b2", "storj"].includes(type)) {
      throw new Error(`Unsupported storage provider type: ${type}`)
    }

    // Test provider configuration
    const provider = this.createProvider({
      id: "test",
      name,
      type,
      config: JSON.stringify(config),
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    try {
      // Test connection by getting storage info
      await provider.getStorageInfo()
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to connect to storage provider: ${error.message}`)
      }
      throw new Error("Failed to connect to storage provider")
    }

    // Save provider to database
    const id = crypto.randomUUID()
    await db.query(`
      INSERT INTO storage_providers (id, name, type, config, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(id, name, type, JSON.stringify(config))

    return id
  }

  async updateStorageProvider(
    id: string,
    updates: {
      name?: string
      config?: Record<string, unknown>
    }
  ): Promise<void> {
    const db = getDatabase()
    const provider = await db.query<StorageProvider>("SELECT * FROM storage_providers WHERE id = ?").get(id)

    if (!provider) {
      throw new Error(`Storage provider not found: ${id}`)
    }

    // Update provider
    if (updates.name) {
      await db.query("UPDATE storage_providers SET name = ? WHERE id = ?").run(updates.name, id)
    }

    if (updates.config) {
      // Test new configuration
      const testProvider = this.createProvider({
        ...provider,
        config: JSON.stringify(updates.config),
      })

      try {
        await testProvider.getStorageInfo()
      } catch (error: unknown) {
        if (error instanceof Error) {
          throw new Error(`Failed to connect to storage provider: ${error.message}`)
        }
        throw new Error("Failed to connect to storage provider")
      }

      await db.query("UPDATE storage_providers SET config = ? WHERE id = ?").run(
        JSON.stringify(updates.config),
        id
      )
    }

    // Remove cached provider to force recreation with new config
    this.providers.delete(id)
  }

  async deleteStorageProvider(id: string): Promise<void> {
    const db = getDatabase()
    await db.query("DELETE FROM storage_providers WHERE id = ?").run(id)
    this.providers.delete(id)
  }

  async listStorageProviders(): Promise<StorageProvider[]> {
    const db = getDatabase()
    return db.query<StorageProvider>("SELECT * FROM storage_providers ORDER BY name").all()
  }
} 