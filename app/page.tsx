"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, CheckCircle, XCircle, Clock, FileArchive } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface BackupStats {
  totalJobs: number
  activeJobs: number
  pausedJobs: number
  successfulBackups: number
  failedBackups: number
  successPercentChange: number
  failedPercentChange: number
  nextScheduled: {
    jobName: string
    time: string
  }
}

interface ActivityItem {
  id: string
  jobName: string
  status: "success" | "failed" | "running"
  message: string
  timestamp: string
}

interface BackupJob {
  id: string
  name: string
  status: string
  next_run: string | null
  last_run: string | null
}

interface StorageProvider {
  id: string
  name: string
  type: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<BackupStats>({
    totalJobs: 0,
    activeJobs: 0,
    pausedJobs: 0,
    successfulBackups: 0,
    failedBackups: 0,
    successPercentChange: 0,
    failedPercentChange: 0,
    nextScheduled: {
      jobName: "",
      time: "",
    },
  })

  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [backupJobs, setBackupJobs] = useState<BackupJob[]>([])
  const [storageProviders, setStorageProviders] = useState<StorageProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchStats()
    fetchActivity()
    fetchBackupJobs()
    fetchStorageProviders()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats")
      if (!response.ok) {
        throw new Error("Failed to fetch stats")
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const fetchActivity = async () => {
    try {
      const response = await fetch("/api/activity")
      if (!response.ok) {
        throw new Error("Failed to fetch activity")
      }
      const data = await response.json()
      setActivity(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const fetchBackupJobs = async () => {
    try {
      const response = await fetch("/api/jobs")
      if (!response.ok) {
        throw new Error("Failed to fetch backup jobs")
      }
      const data = await response.json()
      setBackupJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const fetchStorageProviders = async () => {
    try {
      const response = await fetch("/api/storage")
      if (!response.ok) {
        throw new Error("Failed to fetch storage providers")
      }
      const data = await response.json()
      setStorageProviders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage your backup jobs</p>
          </div>
          <Link href="/jobs/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Backup Job
            </Button>
          </Link>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Backup Jobs</CardTitle>
                  <FileArchive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalJobs}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.activeJobs} active, {stats.pausedJobs} paused
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Successful Backups</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.successfulBackups}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.successPercentChange > 0 ? '+' : ''}{stats.successPercentChange}% from last week
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Backups</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.failedBackups}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.failedPercentChange > 0 ? '+' : ''}{stats.failedPercentChange}% from last week
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{new Date(stats.nextScheduled.time).toUTCString()}</div>
                  <p className="text-xs text-muted-foreground">{stats.nextScheduled.jobName}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks you might want to perform</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/jobs/new">
                    <Button variant="outline" className="w-full justify-start">
                      <Plus className="mr-2 h-4 w-4" />
                      Create new backup job
                    </Button>
                  </Link>
                  <div className="mt-2">
                    {backupJobs.slice(0, 3).map((job) => (
                      <div key={job.id} className="flex items-center justify-between rounded-md border p-2">
                        <div>
                          <p className="text-sm font-medium">{job.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.status} • Next: {job.next_run ? new Date(job.next_run).toLocaleString() : 'Not scheduled'}
                          </p>
                        </div>
                        <Link href={`/jobs/${job.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <Link href="/storage">
                      <Button variant="outline" className="w-full justify-start">
                        <Plus className="mr-2 h-4 w-4" />
                        Configure storage providers
                      </Button>
                    </Link>
                    <div className="mt-2">
                      {storageProviders.slice(0, 3).map((provider) => (
                        <div key={provider.id} className="flex items-center justify-between rounded-md border p-2">
                          <div>
                          <p className="text-sm font-medium">{provider.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{provider.type}</p>
                        </div>
                        <Link href={`/storage`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </div>
                    ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest backup operations and events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    {activity.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-start gap-4">
                        {item.status === "success" && <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />}
                        {item.status === "failed" && <XCircle className="h-5 w-5 text-red-500 mt-0.5" />}
                        {item.status === "running" && <Clock className="h-5 w-5 text-blue-500 mt-0.5" />}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none">{item.jobName}</p>
                            {item.status === "success" && (
                              <Badge className="bg-green-500 text-white">Success</Badge>
                            )}
                            {item.status === "failed" && (
                              <Badge variant="destructive">Failed</Badge>
                            )}
                            {item.status === "running" && (
                              <Badge className="bg-blue-500 text-white">Running</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 text-right">
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="text-xs text-muted-foreground"
                      onClick={() => setActiveTab("activity")}
                    >
                      View all activity
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle>Backup Jobs</CardTitle>
                <CardDescription>Manage your scheduled backup jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Jobs will be loaded from the API */}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>Complete history of backup operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4">
                      {item.status === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {item.status === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
                      {item.status === "running" && <Clock className="h-5 w-5 text-blue-500" />}
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{item.jobName}</p>
                        <p className="text-sm text-muted-foreground">{item.message}</p>
                      </div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

