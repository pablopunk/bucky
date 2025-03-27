"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, FileText, AlertTriangle } from "lucide-react"
import { LoadingState } from "@/components/ui/loading-state"
import { Badge } from "@/components/ui/badge"

// Type for log files
type LogFile = {
  name: string
  path: string
  size?: number
  isEmpty?: boolean
  lastModified?: Date
}

export default function LogsPage() {
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [logContent, setLogContent] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Function to fetch log files
  const fetchLogFiles = useCallback(async () => {
    try {
      const response = await fetch('/api/logs?includeStats=true')
      const data = await response.json()
      
      if (data.files && Array.isArray(data.files)) {
        setLogFiles(data.files)
        
        // Find the first non-empty log file, or just use the first file if all are empty
        const nonEmptyFile = data.files.find((file: LogFile) => !file.isEmpty)
        const firstFile = data.files[0]
        
        if (nonEmptyFile || firstFile) {
          const fileToSelect = nonEmptyFile || firstFile
          setSelectedFile(fileToSelect.name)
          fetchLogContent(fileToSelect.name)
        } else {
          setLogContent("")
          setSelectedFile(null)
        }
      }
    } catch (error) {
      console.error("Error fetching log files:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Function to fetch log content
  const fetchLogContent = useCallback(async (fileName: string) => {
    try {
      const response = await fetch(`/api/logs?file=${fileName}`)
      const data = await response.json()
      setLogContent(data.content || "")
    } catch (error) {
      console.error("Error fetching log content:", error)
      setLogContent("")
    }
  }, [])

  // Format file size for display
  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined) return "Unknown size"
    if (bytes === 0) return "0 B"
    
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // Function to handle log file selection
  const handleSelectFile = (file: LogFile) => {
    setSelectedFile(file.name)
    fetchLogContent(file.name)
  }

  // Function to handle refresh button click
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchLogFiles()
    if (selectedFile) {
      await fetchLogContent(selectedFile)
    }
    setRefreshing(false)
  }

  // Function to handle log file download
  const handleDownload = async (fileName: string) => {
    try {
      const response = await fetch(`/api/logs/download?file=${fileName}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (error) {
      console.error("Error downloading log file:", error)
    }
  }

  // Filter logs by search query
  const filterLogContent = (content: string): string => {
    if (!searchQuery.trim()) return content;
    
    const lines = content.split(/\r?\n/);
    const filteredLines = lines.filter(line => 
      line.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return filteredLines.join('\n');
  }
  
  // Format log content with colors based on log level
  const formatLogLine = (line: string): React.ReactElement => {
    let className = "";
    
    if (line.includes("[ERROR]")) {
      className = "text-red-500";
    } else if (line.includes("[WARN]")) {
      className = "text-amber-500";
    } else if (line.includes("[INFO]")) {
      className = "text-blue-500";
    } else if (line.includes("[DEBUG]")) {
      className = "text-gray-500";
    }
    
    return <div className={className}>{line}</div>;
  }
  
  // Render formatted log content
  const renderLogContent = (content: string): React.ReactElement[] => {
    if (!content) return [];
    
    const filteredContent = filterLogContent(content);
    const lines = filteredContent.split(/\r?\n/);
    
    return lines.map((line, index) => (
      <div key={index}>{formatLogLine(line)}</div>
    ));
  }

  useEffect(() => {
    fetchLogFiles()
  }, [fetchLogFiles])

  if (loading) {
    return <LoadingState />
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">System Logs</h1>
        <div className="flex gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search in logs..."
              className="px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchQuery("")}
              >
                ×
              </button>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Log Files</CardTitle>
          </CardHeader>
          <CardContent>
            {logFiles.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No log files found
              </div>
            ) : (
              <div className="space-y-2">
                {logFiles.map((file) => (
                  <div
                    key={file.name}
                    className={`flex justify-between items-center p-2 rounded cursor-pointer ${
                      selectedFile === file.name
                        ? 'bg-primary/10'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => handleSelectFile(file)}
                  >
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      <div>
                        <div className="font-medium">{file.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {formatFileSize(file.size)}
                          {file.isEmpty && (
                            <Badge variant="outline" className="text-xs">Empty</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation() 
                        handleDownload(file.name)
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>
              {selectedFile ? `Content: ${selectedFile}` : 'Log Content'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedFile ? (
              <div className="text-center py-12 text-muted-foreground">
                Select a log file to view its content
              </div>
            ) : logContent ? (
              <pre className="bg-muted p-4 rounded-md overflow-auto h-[500px] text-sm">
                {renderLogContent(logContent)}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mb-2 text-yellow-500" />
                <p>This log file is empty</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 