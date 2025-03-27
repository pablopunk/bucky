"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRangePicker } from "@/components/date-range-picker"
import { Download, BarChart2, PieChart, ArrowUpRight, ArrowDownRight } from "lucide-react"

interface BackupReport {
  id: string
  jobName: string
  status: "success" | "failed"
  startTime: string
  endTime: string
  duration: number
  size: number
  compressionRatio: number
}

interface StorageUsage {
  provider: string
  used: number
  total: number
  percentage: number
}

interface BackupStats {
  totalBackups: number
  successRate: number
  averageDuration: number
  totalSize: number
  compressionSavings: number
}

export default function ReportsPage() {
  const [reports, setReports] = useState<BackupReport[]>([])
  const [storageUsage, setStorageUsage] = useState<StorageUsage[]>([])
  const [stats, setStats] = useState<BackupStats>({
    totalBackups: 0,
    successRate: 0,
    averageDuration: 0,
    totalSize: 0,
    compressionSavings: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    to: new Date(),
  })

  useEffect(() => {
    fetchReports()
    fetchStorageUsage()
    fetchStats()
  }, [dateRange])

  const fetchReports = async () => {
    try {
      const response = await fetch(
        `/api/reports?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`
      )
      if (!response.ok) {
        throw new Error("Failed to fetch reports")
      }
      const data = await response.json()
      setReports(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const fetchStorageUsage = async () => {
    try {
      const response = await fetch("/api/reports/storage")
      if (!response.ok) {
        throw new Error("Failed to fetch storage usage")
      }
      const data = await response.json()
      setStorageUsage(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `/api/reports/stats?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`
      )
      if (!response.ok) {
        throw new Error("Failed to fetch statistics")
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours}h ${minutes}m ${secs}s`
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
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">View backup reports and analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker
              from={dateRange.from}
              to={dateRange.to}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to })
                }
              }}
            />
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBackups}</div>
              <p className="text-xs text-muted-foreground">
                {stats.successRate}% success rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDuration(stats.averageDuration)}
              </div>
              <p className="text-xs text-muted-foreground">Per backup job</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.compressionSavings}% saved with compression
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {storageUsage.reduce((acc, curr) => acc + curr.percentage, 0) / storageUsage.length}%
              </div>
              <p className="text-xs text-muted-foreground">Average across providers</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Storage Usage by Provider</CardTitle>
              <CardDescription>Current storage utilization across providers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storageUsage.map((usage) => (
                    <TableRow key={usage.provider}>
                      <TableCell className="font-medium">{usage.provider}</TableCell>
                      <TableCell>{formatBytes(usage.used)}</TableCell>
                      <TableCell>{formatBytes(usage.total)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            usage.percentage > 90
                              ? "bg-red-100 text-red-800"
                              : usage.percentage > 70
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {usage.percentage}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Backups</CardTitle>
              <CardDescription>Latest backup operations and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.slice(0, 5).map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.jobName}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {report.status === "success" ? (
                            <ArrowUpRight className="mr-2 h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="mr-2 h-4 w-4 text-red-500" />
                          )}
                          {report.status}
                        </div>
                      </TableCell>
                      <TableCell>{formatBytes(report.size)}</TableCell>
                      <TableCell className="text-right">
                        {formatDuration(report.duration)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Backup History</CardTitle>
            <CardDescription>Detailed history of all backup operations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Compression</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.jobName}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {report.status === "success" ? (
                          <ArrowUpRight className="mr-2 h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="mr-2 h-4 w-4 text-red-500" />
                        )}
                        {report.status}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(report.startTime).toLocaleString()}</TableCell>
                    <TableCell>{new Date(report.endTime).toLocaleString()}</TableCell>
                    <TableCell>{formatDuration(report.duration)}</TableCell>
                    <TableCell>{formatBytes(report.size)}</TableCell>
                    <TableCell className="text-right">{report.compressionRatio}x</TableCell>
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