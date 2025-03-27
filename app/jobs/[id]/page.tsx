"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, CheckCircle, Edit, RefreshCw, StopCircle, Trash, XCircle, Clock, FileArchive } from "lucide-react"
import { toast } from "sonner"

interface BackupJob {
  id: string
  name: string
  source_path: string
  storage_provider_id: string
  schedule: string
  remote_path: string
  status: "active" | "in_progress" | "failed"
  next_run: string | null
  last_run: string | null
  created_at: string
  updated_at: string
}

interface BackupHistory {
  id: string
  job_id: string
  job_name: string
  status: "success" | "failed"
  start_time: string
  end_time: string | null
  size: number | null
  message: string | null
  created_at: string
}

export default function JobDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [job, setJob] = useState<BackupJob | null>(null)
  const [history, setHistory] = useState<BackupHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    fetchJob()
    fetchJobHistory()
  }, [])

  useEffect(() => {
    // If job is running, poll for updates
    if (job?.status === "in_progress") {
      setIsRunning(true)
      const interval = setInterval(() => {
        fetchJob()
        fetchJobHistory()
      }, 2000)

      return () => clearInterval(interval)
    } else {
      setIsRunning(false)
    }
  }, [job?.status])

  const fetchJob = async () => {
    try {
      const id = (await params).id;
      const response = await fetch(`/api/jobs/${id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch backup job")
      }
      const data = await response.json()
      setJob(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const fetchJobHistory = async () => {
    try {
      const id = (await params).id;
      const response = await fetch(`/api/backup-history?jobId=${id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch backup history")
      }
      const data = await response.json()
      setHistory(data)
    } catch (err) {
      console.error("Failed to fetch backup history:", err)
    }
  }

  const runJob = async () => {
    try {
      const id = (await params).id;
      const response = await fetch(`/api/jobs?id=${id}&action=run`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to run backup job")
      }

      setIsRunning(true)
      setJob(prev => prev ? { ...prev, status: "in_progress" } : null)
      toast.success("Backup job started successfully")
      fetchJobHistory()
    } catch (error) {
      toast.error("Failed to run backup job")
      fetchJob() // Ensure UI is in sync
    }
  }

  const stopJob = async () => {
    try {
      const id = (await params).id;
      const response = await fetch(`/api/jobs?id=${id}&action=stop`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to stop backup job")
      }

      setIsRunning(false)
      toast.success("Backup job stopped successfully")
      fetchJob()
      fetchJobHistory()
    } catch (error) {
      toast.error("Failed to stop backup job")
      fetchJob() // Ensure UI is in sync
    }
  }

  const deleteJob = async () => {
    if (!confirm("Are you sure you want to delete this backup job?")) {
      return
    }

    try {
      const id = (await params).id;
      const response = await fetch(`/api/jobs?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete backup job")
      }

      toast.success("Backup job deleted successfully")
      router.push("/jobs")
    } catch (error) {
      toast.error("Failed to delete backup job")
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleString()
  }

  const formatSize = (bytes: number | null) => {
    if (bytes === null) return "Unknown"
    
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 text-white">Active</Badge>
      case "in_progress":
        return <Badge className="bg-blue-500 text-white">Running</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (error || !job) {
    return <div>Error: {error || "Job not found"}</div>
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
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">Job Details</p>
              {getStatusBadge(job.status)}
            </div>
          </div>
          <div className="flex gap-2">
            {job.status === "in_progress" ? (
              <Button variant="outline" onClick={stopJob}>
                <StopCircle className="mr-2 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button variant="outline" onClick={runJob}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Now
              </Button>
            )}
            <Link href={`/jobs/${job.id}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" onClick={deleteJob}>
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Source Path</CardTitle>
              <FileArchive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium truncate">{job.source_path}</div>
              <p className="text-xs text-muted-foreground">Local directory</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remote Path</CardTitle>
              <FileArchive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium truncate">{job.remote_path}</div>
              <p className="text-xs text-muted-foreground">Destination</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Run</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">{formatDate(job.last_run)}</div>
              <p className="text-xs text-muted-foreground">Previous execution</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Run</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">{formatDate(job.next_run)}</div>
              <p className="text-xs text-muted-foreground">Schedule: {job.schedule}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="history" className="space-y-4">
          <TabsList>
            <TabsTrigger value="history">Backup History</TabsTrigger>
            <TabsTrigger value="settings">Job Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Backup History</CardTitle>
                <CardDescription>History of backup operations for this job</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {history.length === 0 ? (
                    <p className="text-muted-foreground">No backup history available</p>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="flex items-start gap-4">
                        {item.status === "success" && <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />}
                        {item.status === "failed" && <XCircle className="h-5 w-5 text-red-500 mt-0.5" />}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none">Backup {item.id.substring(0, 8)}</p>
                            {item.status === "success" && (
                              <Badge className="bg-green-500 text-white">Success</Badge>
                            )}
                            {item.status === "failed" && (
                              <Badge variant="destructive">Failed</Badge>
                            )}
                          </div>
                          {item.message && (
                            <p className="text-sm text-muted-foreground">{item.message}</p>
                          )}
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>{formatDate(item.start_time)}</span>
                            {item.size !== null && <span>{formatSize(item.size)}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Job Settings</CardTitle>
                <CardDescription>Configuration details for this backup job</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Job Name</h3>
                    <p>{job.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Source Path</h3>
                    <p>{job.source_path}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Remote Path</h3>
                    <p>{job.remote_path}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Schedule</h3>
                    <p>{job.schedule}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Created</h3>
                    <p>{formatDate(job.created_at)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Last Updated</h3>
                    <p>{formatDate(job.updated_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
} 