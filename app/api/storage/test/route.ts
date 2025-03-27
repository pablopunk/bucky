import { NextResponse } from "next/server"
import { StorageProviderManager } from "@/lib/storage"
import type { IStorageProvider } from "@/lib/storage/manager"

export async function POST(request: Request) {
  try {
    const { type, config } = await request.json()

    // Validate provider type
    if (type !== "storj") {
      return NextResponse.json(
        { error: "Unsupported storage provider type" },
        { status: 400 }
      )
    }
    
    // Test connection
    try {
      // Create a provider for testing
      const manager = new StorageProviderManager()
      const provider = manager.createProvider({
        id: "test",
        name: "test",
        type: "storj",
        config: JSON.stringify(config),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      // Test the connection
      await provider.getStorageInfo()
      
      return NextResponse.json({ success: true })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to connect to storage provider" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Storage provider test failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Storage provider test failed" },
      { status: 500 }
    )
  }
} 