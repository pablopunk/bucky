"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, RefreshCw, Trash, Edit, StopCircle } from "lucide-react"
import { toast } from "sonner"

interface BackupJob {
  id: string
  name: string
  source_path: string
  storage_provider_id: string
  schedule: string
  retention_period?: number
  compression_enabled?: boolean
  compression_level?: number
  status: "active" | "in_progress" | "failed"
  last_run?: string
  next_run?: string
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

// Add a type guard function
function isInProgress(status: BackupJob['status']): status is "in_progress" {
  return status === "in_progress";
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<BackupJob[]>([])
  const [history, setHistory] = useState<BackupHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchJobs()
    fetchHistory()
  }, [])

  // Handle polling for running jobs
  useEffect(() => {
    const intervals: { [key: string]: ReturnType<typeof setInterval> } = {};

    runningJobs.forEach((jobId) => {
      if (!intervals[jobId]) {
        intervals[jobId] = setInterval(async () => {
          try {
            const jobResponse = await fetch(`/api/jobs/${jobId}`);
            const job = await jobResponse.json();

            if (job.status !== "in_progress") {
              clearInterval(intervals[jobId]);
              delete intervals[jobId];
              setRunningJobs(prev => {
                const next = new Set(prev);
                next.delete(jobId);
                return next;
              });
              await fetchJobs();
              await fetchHistory();
            } else {
              await fetchHistory();
            }
          } catch (error) {
            console.error("Error polling job status:", error);
          }
        }, 2000);
      }
    });

    // Cleanup function
    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, [runningJobs]);

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs")
      if (!response.ok) {
        throw new Error("Failed to fetch backup jobs")
      }
      const data = await response.json()
      console.log("Jobs data from API:", data)
      setJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/backup-history")
      if (!response.ok) {
        throw new Error("Failed to fetch backup history")
      }
      const data = await response.json()
      setHistory(data)
    } catch (err) {
      console.error("Failed to fetch backup history:", err)
    }
  }

  const deleteJob = async (id: string) => {
    try {
      const response = await fetch(`/api/jobs?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete backup job")
      }

      await fetchJobs()
      toast.success("Backup job deleted successfully")
    } catch (error) {
      toast.error("Failed to delete backup job")
    }
  }

  const runJob = async (id: string) => {
    try {
      const response = await fetch(`/api/jobs?id=${id}&action=run`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to run backup job");
      }

      // Add job to running jobs set
      setRunningJobs(prev => new Set(prev).add(id));

      // Immediately update the job status in the UI
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === id 
            ? { ...job, status: "in_progress" as const } 
            : job
        )
      );
      
      await fetchHistory();
      
      toast.success("Backup job started successfully");
    } catch (error) {
      toast.error("Failed to run backup job");
      // Fetch jobs to ensure UI is in sync in case of error
      await fetchJobs();
    }
  };

  const stopJob = async (id: string) => {
    try {
      const response = await fetch(`/api/jobs?id=${id}&action=stop`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to stop backup job");
      }

      // Remove job from running jobs set
      setRunningJobs(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      // Fetch latest data
      await fetchJobs();
      await fetchHistory();
      
      toast.success("Backup job stopped successfully");
    } catch (error) {
      console.error("Failed to stop backup job:", error);
      toast.error("Failed to stop backup job");
      
      // Fetch jobs to ensure UI is in sync
      await fetchJobs();
    }
  };

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
            <h1 className="text-3xl font-bold tracking-tight">Backup Jobs</h1>
            <p className="text-muted-foreground">Manage your automated backup jobs</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchJobs(); fetchHistory(); }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Link href="/jobs/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Job
              </Button>
            </Link>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Backup Jobs</CardTitle>
            <CardDescription>View and manage your backup jobs</CardDescription>
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
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell>{job.source_path}</TableCell>
                    <TableCell>{job.schedule}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className={`mr-2 h-2 w-2 rounded-full ${
                            job.status === "active"
                              ? "bg-green-500"
                              : job.status === "in_progress"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        />
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace("_", " ")}
                      </div>
                    </TableCell>
                    <TableCell>{job.last_run ? new Date(job.last_run).toLocaleString() : "Never"}</TableCell>
                    <TableCell>{job.next_run ? new Date(job.next_run).toLocaleString() : "Not scheduled"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isInProgress(job.status) ? (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => stopJob(job.id)}
                          >
                            <StopCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => runJob(job.id)}
                            disabled={isInProgress(job.status)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Link href={`/jobs/${job.id}/edit`}>
                          <Button variant="outline" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => deleteJob(job.id)}
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

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest backup operations and events</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.job_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className={`mr-2 h-2 w-2 rounded-full ${
                            entry.status === "success" ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </div>
                    </TableCell>
                    <TableCell>{entry.message || "-"}</TableCell>
                    <TableCell>{new Date(entry.created_at).toLocaleString()}</TableCell>
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