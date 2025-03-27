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
import { ArrowLeft, Folder } from "lucide-react"
import { toast } from "sonner"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"

interface StorageProvider {
  id: string
  name: string
  type: "s3" | "b2" | "storj"
  credentials: {
    endpoint: string
    accessKey: string
    secretKey: string
  }
  createdAt: string
  updatedAt: string
}

interface BackupJob {
  name: string
  sourcePath: string
  storageProviderId: string
  schedule: string
  remotePath: string
}

export default function NewBackupJobPage() {
  const router = useRouter()
  const [providers, setProviders] = useState<StorageProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)

  const [jobName, setJobName] = useState("")
  const [sourcePath, setSourcePath] = useState("")
  const [remotePath, setRemotePath] = useState("")
  const [cronExpression, setCronExpression] = useState("0 0 * * *")
  const [storageProviderId, setStorageProviderId] = useState("")

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

  const handleTestConnection = async (provider: StorageProvider) => {
    try {
      setTestingConnection(true)
      
      // Test if toast is working
      toast.error("Testing toast notifications")
      
      console.log("Testing connection to provider:", provider.id)
      const response = await fetch(`/api/storage/${provider.id}/test`, {
        method: "POST",
      })

      console.log("Response status:", response.status)
      const data = await response.json()
      console.log("Response data:", data)
      
      if (data.success) {
        toast.success("Connection test successful!")
      } else {
        console.error("Connection test failed:", data.error)
        toast.error(`Connection test failed: ${data.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Test connection error:", error)
      toast.error("Failed to test connection: Network error")
    } finally {
      setTestingConnection(false)
    }
  }

  const createJob = async (job: BackupJob) => {
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(job),
      })

      if (!response.ok) {
        throw new Error("Failed to create backup job")
      }

      const data = await response.json()
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createJob({
        name: jobName,
        sourcePath,
        storageProviderId,
        schedule: cronExpression,
        remotePath: remotePath || '/',
      })
      toast.success("Backup job created successfully")
      router.push("/jobs")
    } catch (error) {
      toast.error("Failed to create backup job")
    }
  }

  if (loading) {
    return <LoadingState message="Loading New..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => { fetchProviders(); }} />
  }

  const selectedProvider = providers.find(p => p.id === storageProviderId)

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center gap-2">
          <Link href="/jobs">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Create New Backup Job</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Job Settings</CardTitle>
              <CardDescription>Configure your backup job settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-name">Job Name</Label>
                <Input
                  id="job-name"
                  placeholder="My Backup Job"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-path">Source Path</Label>
                <div className="flex gap-2">
                  <Input
                    id="source-path"
                    placeholder="/path/to/source"
                    value={sourcePath}
                    onChange={(e) => setSourcePath(e.target.value)}
                    required
                    className="flex-1"
                  />
                  <Button variant="outline" type="button">
                    <Folder className="mr-2 h-4 w-4" />
                    Browse
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-path">Path on Remote</Label>
                <Input
                  id="remote-path"
                  placeholder="/"
                  value={remotePath}
                  onChange={(e) => setRemotePath(e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Required path on the remote storage where files will be backed up. Use '/' for the root directory.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="storage-provider">Storage Provider</Label>
                <div className="flex gap-2">
                  <Select value={storageProviderId} onValueChange={setStorageProviderId} required>
                    <SelectTrigger id="storage-provider">
                      <SelectValue placeholder="Select a storage provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider: StorageProvider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name} ({provider.type.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProvider && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTestingConnection(true);
                        console.log("Testing connection to provider:", selectedProvider.id);
                        toast.info("Testing connection...");
                        
                        fetch(`/api/storage/${selectedProvider.id}/test`, {
                          method: "POST",
                        })
                          .then(response => {
                            console.log("Response status:", response.status);
                            return response.json();
                          })
                          .then(data => {
                            console.log("Response data:", data);
                            if (data.success) {
                              toast.success("Connection test successful!");
                            } else {
                              toast.error(`Connection test failed: ${data.error || "Unknown error"}`);
                            }
                          })
                          .catch(error => {
                            console.error("Test connection error:", error);
                            toast.error("Failed to test connection: Network error");
                          })
                          .finally(() => {
                            setTestingConnection(false);
                          });
                      }}
                      disabled={testingConnection}
                    >
                      {testingConnection ? "Testing..." : "Test Connection"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="cron-expression">Schedule (Cron Expression)</Label>
                <Input
                  id="cron-expression"
                  placeholder="0 0 * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Format: minute hour day month weekday
                </p>
                <div className="mt-2">
                  <p className="text-sm font-medium mb-2">Common schedules:</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCronExpression("0 * * * *")}
                    >
                      Hourly
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCronExpression("0 */2 * * *")}
                    >
                      Every 2 hours
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCronExpression("0 0 * * *")}
                    >
                      Daily (midnight)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCronExpression("0 0 * * 0")}
                    >
                      Weekly (Sunday)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCronExpression("0 0 1 * *")}
                    >
                      Monthly (1st)
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Email notifications are enabled by default for this backup job.
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="mt-4 flex justify-end gap-2">
            <Link href="/jobs">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit">Create Backup Job</Button>
          </div>
        </form>
      </main>
    </div>
  )
}

