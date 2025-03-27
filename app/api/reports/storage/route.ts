import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import type { StorageProvider } from "@/lib/db"
import { StorageProviderManager } from "@/lib/storage/manager"

export async function GET() {
  try {
    const db = getDatabase()

    // Get all active storage providers
    const providers = db.prepare(`
      SELECT *
      FROM storage_providers
      WHERE status = 'active'
    `).all() as StorageProvider[]

    const manager = new StorageProviderManager()
    const storageInfo = []

    // Get storage info for each provider
    for (const provider of providers) {
      const instance = await manager.getProvider(provider.id)
      const info = await instance.getStorageInfo()

      const usedPercentage = (info.used / info.total) * 100

      storageInfo.push({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        used: info.used,
        total: info.total,
        usedPercentage,
      })
    }

    return NextResponse.json(storageInfo)
  } catch (error) {
    console.error("Error fetching storage info:", error)
    return NextResponse.json(
      { error: "Failed to fetch storage information" },
      { status: 500 }
    )
  }
} 