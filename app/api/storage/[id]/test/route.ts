import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { StorageProvider } from "@/lib/db"
import { StorageProviderManager } from "@/lib/storage"
import { storageLogger } from "@/lib/logger"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Redirect GET requests to use POST instead
  const { id } = params;
  return NextResponse.json(
    { success: false, error: "Please use POST method for testing connections" },
    { status: 405 }
  )
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    storageLogger.info("Test connection request received for provider:", { id })

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
    
    try {
      // Get the provider and test connection by listing the root directory
      const storageProvider = await manager.getProvider(id)
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    storageLogger.error("Error testing storage provider:", { error: errorMessage })
    return NextResponse.json(
      { success: false, error: "Failed to test storage provider" },
      { status: 500 }
    )
  }
} 