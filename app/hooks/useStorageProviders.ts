import { useState, useEffect } from "react"

export interface StorageProvider {
  id: string
  name: string
  type: "s3" | "b2" | "storj"
  credentials: Record<string, any>
  createdAt: string
  updatedAt: string
}

export function useStorageProviders() {
  const [providers, setProviders] = useState<StorageProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      const response = await fetch("/api/storage")
      if (!response.ok) {
        throw new Error("Failed to fetch storage providers")
      }
      const data = await response.json()
      setProviders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const createProvider = async (provider: Omit<StorageProvider, "id" | "createdAt" | "updatedAt">) => {
    try {
      const response = await fetch("/api/storage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(provider),
      })

      if (!response.ok) {
        throw new Error("Failed to create storage provider")
      }

      const data = await response.json()
      await fetchProviders() // Refresh the list
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    }
  }

  const deleteProvider = async (id: string) => {
    try {
      const response = await fetch(`/api/storage?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete storage provider")
      }

      await fetchProviders() // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    }
  }

  return {
    providers,
    loading,
    error,
    createProvider,
    deleteProvider,
    refresh: fetchProviders,
  }
} 