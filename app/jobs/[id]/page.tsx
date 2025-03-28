"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, CheckCircle, Edit, RefreshCw, StopCircle, Trash, XCircle, Clock, FileArchive, ChevronUp, FileIcon, FolderIcon, FilesIcon, FolderOpenIcon } from "lucide-react"
import { toast } from "sonner"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, ShieldAlertIcon, AlertTriangleIcon } from "lucide-react"

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

interface FileSystemItem {
  name: string
  type: "directory" | "file"
  path: string
  size: number
  modified: string
}

interface FileSystemResponse {
  type: "directory" | "file"
  path: string
  parent: string
  contents?: FileSystemItem[]
  name?: string
  size?: number
  modified?: string
}

// Component to show detailed access errors
function RemoteAccessError({ error, onRetry }: { error: string, onRetry: () => void }) {
  const isAccessDenied = error.includes("Access denied") || error.includes("don't have permission")
  const isInvalidCredentials = error.includes("Invalid access credentials") || error.includes("does not exist")
  const isBucketError = error.includes("Bucket") && error.includes("not found")
  const isConfigError = error.includes("Storage provider") || error.includes("bucket not configured")
  
  return (
    <div className="space-y-4">
      <Alert variant={isAccessDenied || isInvalidCredentials ? "destructive" : "default"}>
        {isAccessDenied && <ShieldAlertIcon className="h-4 w-4" />}
        {isInvalidCredentials && <AlertTriangleIcon className="h-4 w-4" />}
        {!isAccessDenied && !isInvalidCredentials && <InfoIcon className="h-4 w-4" />}
        <AlertTitle>
          {isAccessDenied ? "Access Denied" : 
           isInvalidCredentials ? "Invalid Credentials" :
           isBucketError ? "Bucket Not Found" :
           isConfigError ? "Configuration Error" : "Remote Storage Error"}
        </AlertTitle>
        <AlertDescription className="mt-2">
          {error}
          
          <div className="mt-4">
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {isAccessDenied && (
                <>
                  <li>Verify that your S3 user/role has the correct permissions (s3:ListBucket, s3:GetObject)</li>
                  <li>Check if the bucket policy allows access to the specified path</li>
                  <li>Confirm that you're using the correct region for the bucket</li>
                </>
              )}
              {isInvalidCredentials && (
                <>
                  <li>Verify your access key and secret key are correct</li>
                  <li>Check if the credentials have expired or been revoked</li>
                  <li>Ensure you're using the right storage provider settings</li>
                </>
              )}
              {isBucketError && (
                <>
                  <li>Verify the bucket name is spelled correctly</li>
                  <li>Check if the bucket exists in your account</li>
                  <li>Make sure you're connecting to the right region</li>
                </>
              )}
              {isConfigError && (
                <>
                  <li>Update your storage provider settings with the correct bucket name</li>
                  <li>Verify all required fields are filled out</li>
                </>
              )}
            </ul>
          </div>
        </AlertDescription>
      </Alert>
      
      <div className="flex space-x-4 justify-center">
        <Button variant="outline" onClick={onRetry}>
          Try Again
        </Button>
        <Link href={`/storage`}>
          <Button variant="default">
            Edit Storage Provider
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default function JobDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [job, setJob] = useState<BackupJob | null>(null)
  const [history, setHistory] = useState<BackupHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  
  // State for filesystem browsing
  const [sourceFiles, setSourceFiles] = useState<FileSystemItem[]>([])
  const [remoteFiles, setRemoteFiles] = useState<FileSystemItem[]>([])
  const [currentSourcePath, setCurrentSourcePath] = useState<string>("/")
  const [currentRemotePath, setCurrentRemotePath] = useState<string>("/")
  const [sourcePathParts, setSourcePathParts] = useState<string[]>([])
  const [remotePathParts, setRemotePathParts] = useState<string[]>([])
  const [loadingSource, setLoadingSource] = useState<boolean>(false)
  const [loadingRemote, setLoadingRemote] = useState<boolean>(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)

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

  const fetchSourceFiles = async (path: string = "/") => {
    setLoadingSource(true)
    setSourceError(null)
    try {
      const id = (await params).id;
      const response = await fetch(`/api/filesystem?type=local&jobId=${id}&path=${encodeURIComponent(path)}`)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch source files")
      }
      
      const data: FileSystemResponse = await response.json()
      
      if (data.type === "directory" && data.contents) {
        setSourceFiles(data.contents)
        setCurrentSourcePath(data.path)
        
        // Create breadcrumbs
        const parts = data.path === "/" 
          ? [] 
          : data.path.split("/").filter(Boolean)
        
        setSourcePathParts(parts)
      }
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : "Failed to fetch source files")
    } finally {
      setLoadingSource(false)
    }
  }
  
  const fetchRemoteFiles = async (path: string = "/") => {
    setLoadingRemote(true)
    setRemoteError(null)
    try {
      const id = (await params).id;
      const response = await fetch(`/api/filesystem?type=remote&jobId=${id}&path=${encodeURIComponent(path)}`)
      
      if (!response.ok) {
        const data = await response.json()
        
        // Enhanced error handling based on API responses
        if (data.error) {
          throw new Error(data.error)
        }
        
        throw new Error("Failed to fetch remote files")
      }
      
      const data: FileSystemResponse = await response.json()
      
      if (data.type === "directory" && data.contents) {
        setRemoteFiles(data.contents)
        setCurrentRemotePath(data.path)
        
        // Create breadcrumbs
        const parts = data.path === "/" 
          ? [] 
          : data.path.split("/").filter(Boolean)
        
        setRemotePathParts(parts)
      }
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : "Failed to fetch remote files")
    } finally {
      setLoadingRemote(false)
    }
  }
  
  const navigateToSourcePath = (path: string) => {
    fetchSourceFiles(path)
  }
  
  const navigateToRemotePath = (path: string) => {
    fetchRemoteFiles(path)
  }
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  
  useEffect(() => {
    if (job && !loading) {
      // Only load source/remote files when job details are loaded and user clicks the tabs
    }
  }, [job])

  if (loading) {
    return <LoadingState message="Loading data..." />
  }

  if (error || !job) {
    return <ErrorState error={error || "Job not found"} onRetry={() => { fetchJob(); fetchJobHistory(); }} />
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
            <TabsTrigger value="source" onClick={() => fetchSourceFiles()}>Browse Source</TabsTrigger>
            <TabsTrigger value="remote" onClick={() => fetchRemoteFiles()}>Browse Remote</TabsTrigger>
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
                            <p className="text-sm text-muted-foreground whitespace-normal">{item.message}</p>
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
          
          <TabsContent value="source">
            <Card>
              <CardHeader>
                <CardTitle>Browse Source Files</CardTitle>
                <CardDescription>Explore the local source directory</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center mb-4">
                  <Breadcrumb className="flex-1">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="#" onClick={() => navigateToSourcePath("/")}>
                          <FolderIcon className="h-4 w-4 mr-1" />
                          Source
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      
                      {sourcePathParts.map((part, index) => {
                        const path = `/${sourcePathParts.slice(0, index + 1).join("/")}`
                        return (
                          <BreadcrumbItem key={path}>
                            <BreadcrumbSeparator>/</BreadcrumbSeparator>
                            <BreadcrumbLink href="#" onClick={() => navigateToSourcePath(path)}>
                              {part}
                            </BreadcrumbLink>
                          </BreadcrumbItem>
                        )
                      })}
                    </BreadcrumbList>
                  </Breadcrumb>
                  
                  <Button variant="outline" size="sm" onClick={() => {
                    const parentPath = currentSourcePath === "/" 
                      ? "/"
                      : `/${sourcePathParts.slice(0, sourcePathParts.length - 1).join("/")}`
                    navigateToSourcePath(parentPath)
                  }} disabled={currentSourcePath === "/"}>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Up
                  </Button>
                </div>
                
                {loadingSource && <LoadingState message="Loading files..." />}
                
                {sourceError && <ErrorState error={sourceError} onRetry={() => fetchSourceFiles(currentSourcePath)} />}
                
                {!loadingSource && !sourceError && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Modified</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sourceFiles.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No files found in this directory
                            </TableCell>
                          </TableRow>
                        ) : (
                          sourceFiles.map((file) => (
                            <TableRow key={file.path}>
                              <TableCell>
                                {file.type === "directory" ? (
                                  <button 
                                    className="flex items-center hover:underline"
                                    onClick={() => navigateToSourcePath(file.path)}
                                  >
                                    <FolderIcon className="h-4 w-4 mr-2 text-blue-500" />
                                    {file.name}
                                  </button>
                                ) : (
                                  <div className="flex items-center">
                                    <FileIcon className="h-4 w-4 mr-2 text-gray-500" />
                                    {file.name}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {file.type === "directory" ? "—" : formatFileSize(file.size)}
                              </TableCell>
                              <TableCell>
                                {new Date(file.modified).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="remote">
            <Card>
              <CardHeader>
                <CardTitle>Browse Remote Files</CardTitle>
                <CardDescription>Explore the remote backup destination</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center mb-4">
                  <Breadcrumb className="flex-1">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="#" onClick={() => navigateToRemotePath("/")}>
                          <FolderIcon className="h-4 w-4 mr-1" />
                          Remote
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      
                      {remotePathParts.map((part, index) => {
                        const path = `/${remotePathParts.slice(0, index + 1).join("/")}`
                        return (
                          <BreadcrumbItem key={path}>
                            <BreadcrumbSeparator>/</BreadcrumbSeparator>
                            <BreadcrumbLink href="#" onClick={() => navigateToRemotePath(path)}>
                              {part}
                            </BreadcrumbLink>
                          </BreadcrumbItem>
                        )
                      })}
                    </BreadcrumbList>
                  </Breadcrumb>
                  
                  <Button variant="outline" size="sm" onClick={() => {
                    const parentPath = currentRemotePath === "/" 
                      ? "/"
                      : `/${remotePathParts.slice(0, remotePathParts.length - 1).join("/")}`
                    navigateToRemotePath(parentPath)
                  }} disabled={currentRemotePath === "/"}>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Up
                  </Button>
                </div>
                
                {loadingRemote && <LoadingState message="Loading files..." />}
                
                {remoteError && <RemoteAccessError error={remoteError} onRetry={() => fetchRemoteFiles(currentRemotePath)} />}
                
                {!loadingRemote && !remoteError && (
                  <div className="rounded-md border">
                    <div className="p-2 border-b flex justify-between items-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={async () => {
                          try {
                            setLoadingRemote(true);
                            const id = (await params).id;
                            const response = await fetch(`/api/filesystem?type=remote&jobId=${id}&path=/&debug=true`);
                            const data = await response.json();
                            if (!response.ok) {
                              throw new Error(data.error || 'Connection test failed');
                            }
                            toast.success('Connection successful!');
                            fetchRemoteFiles('/');
                          } catch (err) {
                            toast.error(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                            setRemoteError(err instanceof Error ? err.message : 'Connection test failed');
                          } finally {
                            setLoadingRemote(false);
                          }
                        }}
                      >
                        Refresh
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Modified</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {remoteFiles.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No files found in this directory
                            </TableCell>
                          </TableRow>
                        ) : (
                          remoteFiles.map((file) => (
                            <TableRow key={file.path}>
                              <TableCell>
                                {file.type === "directory" ? (
                                  <button 
                                    className="flex items-center hover:underline"
                                    onClick={() => navigateToRemotePath(file.path)}
                                  >
                                    <FolderIcon className="h-4 w-4 mr-2 text-blue-500" />
                                    {file.name}
                                  </button>
                                ) : (
                                  <div className="flex items-center">
                                    <FileIcon className="h-4 w-4 mr-2 text-gray-500" />
                                    {file.name}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {file.type === "directory" ? "—" : formatFileSize(file.size)}
                              </TableCell>
                              <TableCell>
                                {new Date(file.modified).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
} 