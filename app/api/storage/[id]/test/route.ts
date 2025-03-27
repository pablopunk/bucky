import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { StorageProvider } from "@/lib/db"
import { StorageProviderManager } from "@/lib/storage"

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  console.log("Test connection request received for provider:", context.params)

  try {
    // Get storage provider from database
    const db = getDatabase()
    const params = await context.params
    const provider = db.prepare(
      `SELECT * FROM storage_providers WHERE id = ?`
    ).get(params.id) as StorageProvider | null

    if (!provider) {
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
      await storageProvider.list("/")
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Connection test error:", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Unknown error" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error testing storage provider:", error)
    return NextResponse.json(
      { success: false, error: "Failed to test storage provider" },
      { status: 500 }
    )
  }
} 