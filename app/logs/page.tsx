"use client"

import { useEffect, useState } from "react"
import { DownloadIcon, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

type LogFile = {
  name: string
  path: string
}

export default function LogsPage() {
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [selectedLog, setSelectedLog] = useState<string>("")
  const [logContent, setLogContent] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch available log files
  const fetchLogFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/logs")
      if (!response.ok) {
        throw new Error("Failed to fetch log files")
      }
      const data = await response.json()
      setLogFiles(data.files || [])
      
      // Select the first log file by default if available
      if (data.files && data.files.length > 0 && !selectedLog) {
        setSelectedLog(data.files[0].name)
      }
    } catch (error) {
      console.error("Error fetching logs:", error)
      toast.error("Failed to load log files")
    } finally {
      setLoading(false)
    }
  }

  // Fetch log content for a specific file
  const fetchLogContent = async (fileName: string) => {
    if (!fileName) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/logs?file=${encodeURIComponent(fileName)}`)
      if (!response.ok) {
        throw new Error("Failed to fetch log content")
      }
      const data = await response.json()
      setLogContent(data.content || "No logs available")
    } catch (error) {
      console.error("Error fetching log content:", error)
      toast.error("Failed to load log content")
      setLogContent("Error loading log content")
    } finally {
      setLoading(false)
    }
  }

  // Handle refresh button click
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchLogFiles()
    if (selectedLog) {
      await fetchLogContent(selectedLog)
    }
    setRefreshing(false)
    toast.success("Logs refreshed")
  }

  // Handle log file selection
  const handleLogSelect = (value: string) => {
    setSelectedLog(value)
    fetchLogContent(value)
  }

  // Download complete log file
  const handleDownload = async () => {
    if (!selectedLog) return
    
    try {
      window.open(`/api/logs/download?file=${encodeURIComponent(selectedLog)}`, '_blank')
    } catch (error) {
      console.error("Error downloading log file:", error)
      toast.error("Failed to download log file")
    }
  }

  // Initial load
  useEffect(() => {
    fetchLogFiles()
  }, [])

  // Fetch log content when selected log changes
  useEffect(() => {
    if (selectedLog) {
      fetchLogContent(selectedLog)
    }
  }, [selectedLog])

  return (
    <div className="flex flex-col space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">View application and job logs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownload}
            disabled={!selectedLog}
          >
            <DownloadIcon className="h-4 w-4 mr-2" />
            Download Full Log
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Log Viewer</CardTitle>
              <CardDescription>
                View recent logs (limited to 1000 lines in the UI)
              </CardDescription>
            </div>
            <Select value={selectedLog} onValueChange={handleLogSelect}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a log file" />
              </SelectTrigger>
              <SelectContent>
                {logFiles.length === 0 ? (
                  <SelectItem value="none" disabled>No log files available</SelectItem>
                ) : (
                  logFiles.map((file) => (
                    <SelectItem key={file.name} value={file.name}>
                      {file.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[500px] flex items-center justify-center">
              <p>Loading logs...</p>
            </div>
          ) : (
            <pre className="bg-card border rounded-md p-4 h-[500px] overflow-auto text-sm font-mono whitespace-pre-wrap">
              {logContent || "Select a log file to view"}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 