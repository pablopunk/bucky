import { useState, useEffect } from "react"

export interface BackupJob {
  id: string
  name: string
  sourcePath: string
  destinationProvider: string
  schedule: string
  retentionDays: number
  compression: boolean
  encryption: boolean
  status: "active" | "in_progress" | "failed"
  lastRun?: string
  nextRun?: string
  createdAt: string
  updatedAt: string
}

export function useBackupJobs() {
  const [jobs, setJobs] = useState<BackupJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs")
      if (!response.ok) {
        throw new Error("Failed to fetch backup jobs")
      }
      const data = await response.json()
      setJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const createJob = async (job: Omit<BackupJob, "id" | "createdAt" | "updatedAt" | "status" | "lastRun" | "nextRun">) => {
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
      await fetchJobs() // Refresh the list
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
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

      await fetchJobs() // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    }
  }

  return {
    jobs,
    loading,
    error,
    createJob,
    deleteJob,
    refresh: fetchJobs,
  }
} 