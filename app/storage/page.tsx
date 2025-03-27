"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Cloud, Database, Edit, Plus, RefreshCw, Trash, CloudOff } from "lucide-react"
import { toast } from "sonner"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"

interface StorageProvider {
  id: string
  name: string
  type: "s3" | "b2" | "storj"
  status?: string // Will be replaced by connectionStatus
  created_at: string
  updated_at: string
}

interface ConnectionStatus {
  id: string
  connected: boolean
  error?: string
}

export default function StoragePage() {
  const [providers, setProviders] = useState<StorageProvider[]>([])
  const [connectionStatuses, setConnectionStatuses] = useState<{ [id: string]: ConnectionStatus }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState<boolean>(false)

  useEffect(() => {
    fetchProvidersAndTest()
  }, [])

  const fetchProvidersAndTest = async () => {
    try {
      await fetchProviders()
      await testAllConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const fetchProviders = async () => {
    try {
      const response = await fetch("/api/storage")
      if (!response.ok) {
        throw new Error("Failed to fetch storage providers")
      }
      const data = await response.json()
      setProviders(data)
      return data
    } catch (err) {
      throw err
    }
  }

  const testAllConnections = async () => {
    setTestingConnection(true)
    try {
      const response = await fetch("/api/storage/test-all")
      if (!response.ok) {
        throw new Error("Failed to test connections")
      }
      const data = await response.json()
      
      // Create a map of provider ID to connection status
      const statusMap: { [id: string]: ConnectionStatus } = {}
      data.results.forEach((result: ConnectionStatus) => {
        statusMap[result.id] = result
      })
      
      setConnectionStatuses(statusMap)
    } catch (err) {
      console.error("Error testing connections:", err)
      toast.error("Failed to test provider connections")
    } finally {
      setTestingConnection(false)
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

      await fetchProvidersAndTest()
      toast.success("Storage provider deleted successfully")
    } catch (error) {
      toast.error("Failed to delete storage provider")
    }
  }

  const handleTestConnection = async (providerId: string) => {
    try {
      setTestingConnection(true)
      const response = await fetch(`/api/storage/${providerId}/test`, {
        method: "POST",
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Update connection status
        setConnectionStatuses(prev => ({
          ...prev,
          [providerId]: {
            id: providerId,
            connected: true
          }
        }))
        toast.success("Connection test successful")
      } else {
        // Update connection status
        setConnectionStatuses(prev => ({
          ...prev,
          [providerId]: {
            id: providerId,
            connected: false,
            error: data.error || "Unknown error"
          }
        }))
        toast.error(`Connection test failed: ${data.error || "Unknown error"}`)
      }
    } catch (error) {
      toast.error("Connection test failed")
    } finally {
      setTestingConnection(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await fetchProvidersAndTest()
    setLoading(false)
  }

  if (loading) {
    return <LoadingState message="Loading Storage..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => { fetchProvidersAndTest(); }} />
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Storage Providers</h1>
            <p className="text-muted-foreground">Manage your storage providers</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={testingConnection}>
              <RefreshCw className={`mr-2 h-4 w-4 ${testingConnection ? 'animate-spin' : ''}`} />
              {testingConnection ? 'Testing...' : 'Refresh'}
            </Button>
            <Link href="/storage/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Provider
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Storage Providers</CardTitle>
            <CardDescription>View and manage your storage providers</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No storage providers found
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((provider) => {
                    const connectionStatus = connectionStatuses[provider.id]
                    const isConnected = connectionStatus?.connected
                    
                    return (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.name}</TableCell>
                        <TableCell>{provider.type.toUpperCase()}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              isConnected
                                ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                                : "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
                            }`}
                          >
                            {isConnected 
                              ? <><Cloud className="mr-1 h-3 w-3" />Connected</> 
                              : <><CloudOff className="mr-1 h-3 w-3" />Disconnected</>}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(provider.created_at).toLocaleString()}</TableCell>
                        <TableCell>{new Date(provider.updated_at).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => handleTestConnection(provider.id)}
                              title="Test connection"
                            >
                              <Cloud className="h-4 w-4" />
                            </Button>
                            <Link href={`/storage/${provider.id}/edit`}>
                              <Button variant="outline" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deleteProvider(provider.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

