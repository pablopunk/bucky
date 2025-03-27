"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Folder } from "lucide-react"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"

interface StorageProvider {
  id: string
  name: string
  type: string
}

interface BackupJob {
  id: string
  name: string
  source_path: string
  storage_provider_id: string
  schedule: string
  remote_path: string
  status: string
  next_run?: string | null
  last_run?: string | null
}

export default function EditBackupJobPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [providers, setProviders] = useState<StorageProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [jobName, setJobName] = useState("")
  const [sourcePath, setSourcePath] = useState("")
  const [remotePath, setRemotePath] = useState("")
  const [cronExpression, setCronExpression] = useState("")
  const [storageProviderId, setStorageProviderId] = useState("")

  useEffect(() => {
    fetchProviders()
    fetchJob()
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
    }
  }

  const fetchJob = async () => {
    try {
      const id = (await params).id
      const response = await fetch(`/api/jobs/${id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch backup job")
      }
      const job: BackupJob = await response.json()
      
      setJobName(job.name)
      setSourcePath(job.source_path)
      setRemotePath(job.remote_path)
      setCronExpression(job.schedule)
      setStorageProviderId(job.storage_provider_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = (await params).id
    try {
      const response = await fetch(`/api/jobs/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: jobName,
          sourcePath: sourcePath,
          storageProviderId: storageProviderId,
          schedule: cronExpression,
          remotePath: remotePath || '/',
          notifications: true, // Always set notifications to true
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update backup job")
      }

      toast.success("Backup job updated successfully")
      router.push("/jobs")
    } catch (error) {
      toast.error("Failed to update backup job")
    }
  }

  if (loading) {
    return <LoadingState message="Loading Edit..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => { fetchProviders(); fetchJob(); }} />
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Edit Backup Job</h1>
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
            <Button type="submit">Update Backup Job</Button>
          </div>
        </form>
      </main>
    </div>
  )
} 