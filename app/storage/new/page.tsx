"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

interface S3Credentials {
  type: "s3"
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  region?: string
  endpoint?: string
}

interface B2Credentials {
  type: "b2"
  applicationKeyId: string
  applicationKey: string
  bucket: string
}

interface StorjCredentials {
  type: "storj"
  accessGrant: string
  encryptionKey: string
  bucket: string
}

type StorageCredentials = S3Credentials | B2Credentials | StorjCredentials

export default function NewStorageProviderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)

  const [name, setName] = useState("")
  const [type, setType] = useState<"s3" | "b2" | "storj">("s3")
  const [bucket, setBucket] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [region, setRegion] = useState("")

  // Helper function to build config object based on provider type
  const buildConfig = () => {
    if (type === "storj") {
      return {
        accessKey,
        secretKey,
        bucket,
        endpoint: endpoint || "https://gateway.storjshare.io",
      }
    } else if (type === "s3") {
      return {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
        bucket,
        region: region || "us-east-1",
        endpoint: endpoint || undefined,
      }
    } else if (type === "b2") {
      return {
        applicationKeyId: accessKey,
        applicationKey: secretKey,
        bucket,
      }
    }
    return {}
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setError(null)

    try {
      const config = buildConfig()
      
      // For testing, we need to send all the provider details
      const response = await fetch("/api/storage/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          config,
        }),
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        toast.success("Connection test successful!")
      } else {
        const errorMessage = data.error || "Connection test failed"
        toast.error(errorMessage)
        setError(errorMessage)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Connection test failed"
      toast.error(errorMessage)
      setError(errorMessage)
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const config = buildConfig()

      const response = await fetch("/api/storage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          type,
          credentials: {
            type,
            ...config
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ? JSON.stringify(data.error) : "Failed to create storage provider")
      }

      toast.success("Storage provider created successfully")
      router.push("/storage")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-2xl font-bold tracking-tight">New Storage Provider</h1>
        </div>

        {error && (
          <div className="bg-destructive/15 text-destructive border border-destructive/20 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Storage Provider Settings</CardTitle>
              <CardDescription>Configure your storage provider details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Storage Provider"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as "s3" | "b2" | "storj")}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select a provider type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s3">Amazon S3</SelectItem>
                    <SelectItem value="b2">Backblaze B2</SelectItem>
                    <SelectItem value="storj">Storj</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bucket">Bucket</Label>
                <Input
                  id="bucket"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  placeholder="my-bucket"
                  required
                />
              </div>

              {type === "storj" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="accessKey">Access Key</Label>
                    <Input
                      id="accessKey"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secretKey">Secret Key</Label>
                    <Input
                      id="secretKey"
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endpoint">Endpoint (optional)</Label>
                    <Input
                      id="endpoint"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="https://gateway.storjshare.io"
                    />
                  </div>
                </>
              )}

              {type === "s3" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="accessKeyId">Access Key ID</Label>
                    <Input
                      id="accessKeyId"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                    <Input
                      id="secretAccessKey"
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
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="us-east-1"
                    />
                    <p className="text-sm text-muted-foreground">
                      Default: us-east-1
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s3endpoint">Endpoint (optional)</Label>
                    <Input
                      id="s3endpoint"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="Leave empty for standard AWS S3"
                    />
                    <p className="text-sm text-muted-foreground">
                      For S3-compatible services: https://gateway.storjshare.io, https://s3.wasabisys.com, etc.
                    </p>
                  </div>
                </>
              )}

              {type === "b2" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="applicationKeyId">Application Key ID</Label>
                    <Input
                      id="applicationKeyId"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="applicationKey">Application Key</Label>
                    <Input
                      id="applicationKey"
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="pt-4 flex justify-end space-x-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => router.push("/storage")}
                >
                  Cancel
                </Button>
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={handleTestConnection}
                  disabled={testingConnection || !accessKey || !secretKey || !bucket}
                >
                  {testingConnection ? "Testing..." : "Test Connection"}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Storage Provider"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  )
} 