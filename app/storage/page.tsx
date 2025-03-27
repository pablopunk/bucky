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
import { Cloud, Database, Edit, Plus, RefreshCw, Trash } from "lucide-react"
import { toast } from "sonner"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"

interface StorageProvider {
  id: string
  name: string
  type: "s3" | "b2" | "storj"
  status: string
  created_at: string
  updated_at: string
}

export default function StoragePage() {
  const [providers, setProviders] = useState<StorageProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newProvider, setNewProvider] = useState<{
    name: string
    type: "s3" | "b2" | "storj"
    credentials: {
      endpoint: string
      accessKey: string
      secretKey: string
    }
  }>({
    name: "",
    type: "storj",
    credentials: {
      endpoint: "",
      accessKey: "",
      secretKey: "",
    },
  })

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

  const handleAddProvider = async () => {
    try {
      const response = await fetch("/api/storage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newProvider),
      })

      if (!response.ok) {
        throw new Error("Failed to create storage provider")
      }

      await fetchProviders()
      setNewProvider({
        name: "",
        type: "storj",
        credentials: {
          endpoint: "",
          accessKey: "",
          secretKey: "",
        },
      })
      setIsAddDialogOpen(false)
      toast.success("Storage provider added successfully")
    } catch (error) {
      toast.error("Failed to add storage provider")
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

      await fetchProviders()
      toast.success("Storage provider deleted successfully")
    } catch (error) {
      toast.error("Failed to delete storage provider")
    }
  }

  const handleTestConnection = async (provider: StorageProvider) => {
    try {
      // TODO: Implement connection test
      toast.success("Connection test successful")
    } catch (error) {
      toast.error("Connection test failed")
    }
  }

  if (loading) {
    return <LoadingState message="Loading Storage..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => { fetchProviders(); }} />
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Storage Providers</h1>
            <p className="text-muted-foreground">Manage your storage providers</p>
          </div>
          <Link href="/storage/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Provider
            </Button>
          </Link>
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
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell>{provider.type.toUpperCase()}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          provider.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {provider.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(provider.created_at).toLocaleString()}</TableCell>
                    <TableCell>{new Date(provider.updated_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

