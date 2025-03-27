"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"

interface StorageProvider {
  id: string
  name: string
  type: "s3" | "b2" | "storj"
  config: string
  status: string
  created_at: string
  updated_at: string
}

export default function EditStorageProviderPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<StorageProvider | null>(null)

  const [name, setName] = useState("")
  const [type, setType] = useState<"s3" | "b2" | "storj">("s3")
  const [bucket, setBucket] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [region, setRegion] = useState("")

  useEffect(() => {
    fetchProvider()
  }, [params.id])

  const fetchProvider = async () => {
    try {
      const response = await fetch(`/api/storage?id=${params.id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch storage provider")
      }
      const data = await response.json()
      setProvider(data)
      setName(data.name)
      setType(data.type)
      
      const config = JSON.parse(data.config)
      setBucket(config.bucket)
      if (data.type === "storj") {
        setAccessKey(config.accessKey)
        setSecretKey(config.secretKey)
        setEndpoint(config.endpoint || "")
      } else if (data.type === "s3") {
        setAccessKey(config.accessKeyId)
        setSecretKey(config.secretAccessKey)
        setRegion(config.region || "")
        setEndpoint(config.endpoint || "")
      } else if (data.type === "b2") {
        setAccessKey(config.applicationKeyId)
        setSecretKey(config.applicationKey)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let credentials: Record<string, any> = {
        type,
        bucket,
      }

      if (type === "storj") {
        credentials = {
          ...credentials,
          accessKey,
          secretKey,
          endpoint: endpoint || "https://gateway.storjshare.io",
        }
      } else if (type === "s3") {
        credentials = {
          ...credentials,
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
          region: region || "us-east-1",
          endpoint: endpoint || undefined,
        }
      } else if (type === "b2") {
        credentials = {
          ...credentials,
          applicationKeyId: accessKey,
          applicationKey: secretKey,
        }
      }

      const response = await fetch(`/api/storage?id=${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          type,
          credentials,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update storage provider")
      }

      toast.success("Storage provider updated successfully")
      router.push("/storage")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingState message="Loading Edit..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => { fetchProvider(); }} />
  }

  if (!provider) {
    return <div>Provider not found</div>
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center gap-2">
          <Link href="/storage">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Edit Storage Provider</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Provider Details</CardTitle>
              <CardDescription>Update your storage provider configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Provider Name</Label>
                <Input
                  id="name"
                  placeholder="My Storage Provider"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Provider Type</Label>
                <Select value={type} onValueChange={(value: "s3" | "b2" | "storj") => setType(value)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s3">Amazon S3</SelectItem>
                    <SelectItem value="b2">Backblaze B2</SelectItem>
                    <SelectItem value="storj">Storj</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bucket">Bucket Name</Label>
                <Input
                  id="bucket"
                  placeholder="my-bucket"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  required
                />
              </div>

              {type === "storj" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="access-key">Access Key</Label>
                    <Input
                      id="access-key"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret-key">Secret Key</Label>
                    <Input
                      id="secret-key"
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint">Endpoint</Label>
                    <Input
                      id="endpoint"
                      placeholder="https://gateway.storjshare.io"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                    />
                  </div>
                </>
              )}

              {type === "s3" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="access-key">Access Key ID</Label>
                    <Input
                      id="access-key"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret-key">Secret Access Key</Label>
                    <Input
                      id="secret-key"
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      placeholder="us-east-1"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint">Endpoint (optional)</Label>
                    <Input
                      id="endpoint"
                      placeholder="https://s3.amazonaws.com"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                    />
                  </div>
                </>
              )}

              {type === "b2" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="access-key">Application Key ID</Label>
                    <Input
                      id="access-key"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret-key">Application Key</Label>
                    <Input
                      id="secret-key"
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-end gap-2">
            <Link href="/storage">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Provider"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
} 