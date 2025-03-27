import { NextResponse } from "next/server"
import { StorageProviderManager, StorageCredentials } from "@/lib/storage"
import { storageLogger } from "@/lib/logger"

export async function POST(request: Request) {
  storageLogger.info("Test connection request received for new provider")

  try {
    const { type, config } = await request.json()

    // Validate type
    if (!["s3", "b2", "storj"].includes(type)) {
      storageLogger.error("Invalid storage provider type", { type })
      return NextResponse.json(
        { success: false, error: `Unsupported storage provider type: ${type}` },
        { status: 400 }
      )
    }

    // Create provider instance with config
    const manager = new StorageProviderManager()
    
    try {
      // Create the provider with the credentials
      const credentials: StorageCredentials = {
        type: type as "s3" | "b2" | "storj",
        ...config
      }

      storageLogger.info("Testing connection to storage provider", { type })
      const storageProvider = manager.create(credentials)
      
      // Test connection by trying to list the root directory
      await storageProvider.list("/")
      
      storageLogger.info("Connection test successful", { type })
      return NextResponse.json({ success: true })
    } catch (error) {
      storageLogger.error("Connection test error:", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Unknown error" },
        { status: 400 }
      )
    }
  } catch (error) {
    storageLogger.error("Error testing storage provider:", error)
    return NextResponse.json(
      { success: false, error: "Failed to test storage provider" },
      { status: 500 }
    )
  }
} 