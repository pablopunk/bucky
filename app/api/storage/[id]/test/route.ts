import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { StorageProvider } from "@/lib/db"
import { StorageProviderManager } from "@/lib/storage"
import { storageLogger } from "@/lib/logger"

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  storageLogger.info("Test connection request received for provider:", context.params)

  try {
    const id = (await context.params).id;
    // Get storage provider from database
    const db = getDatabase()
    const provider = db.prepare(
      `SELECT * FROM storage_providers WHERE id = ?`
    ).get(id) as StorageProvider | null

    if (!provider) {
      storageLogger.error("Storage provider not found", { id })
      return NextResponse.json(
        { success: false, error: "Storage provider not found" },
        { status: 404 }
      )
    }

    // Initialize storage provider manager and get provider instance
    const manager = new StorageProviderManager()
    
    // Create provider instance with config
    const config = JSON.parse(provider.config)
    const storageProvider = manager.create({
      type: provider.type as "s3" | "b2" | "storj",
      ...config
    })

    // Test connection by trying to list the root directory
    try {
      storageLogger.info("Testing connection to storage provider", { id, type: provider.type })
      await storageProvider.list("/")
      storageLogger.info("Connection test successful", { id })
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