"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Cloud, Edit, Folder, MoreHorizontal, Play, Plus, Trash } from "lucide-react"

// Mock data for demonstration
const mockJobs = [
  {
    id: "job-1",
    name: "Website Backup",
    source: "/var/www/html",
    destination: "storj:website-backup",
    schedule: "0 0 * * *", // Daily at midnight
    lastRun: "2023-10-15T00:00:00Z",
    status: "success",
    type: "Storj",
  },
  {
    id: "job-2",
    name: "Database Backup",
    source: "/var/lib/mysql",
    destination: "storj:database-backup",
    schedule: "0 0 * * 0", // Weekly on Sunday
    lastRun: "2023-10-15T00:00:00Z",
    status: "success",
    type: "Storj",
  },
  {
    id: "job-3",
    name: "User Files Backup",
    source: "/home/user/documents",
    destination: "local:/mnt/backup/documents",
    schedule: "0 0 1 * *", // Monthly on the 1st
    lastRun: "2023-10-01T00:00:00Z",
    status: "failed",
    type: "Local",
  },
  {
    id: "job-4",
    name: "Configuration Backup",
    source: "/etc",
    destination: "storj:config-backup",
    schedule: "0 0 * * 1-5", // Weekdays at midnight
    lastRun: "2023-10-13T00:00:00Z",
    status: "running",
    type: "Storj",
  },
]

export function BackupJobsList() {
  const [jobs, setJobs] = useState(mockJobs)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500 dark:bg-green-600 text-white">Success</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "running":
        return <Badge className="bg-blue-500 dark:bg-blue-600 text-white">Running</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleDelete = (id: string) => {
    setJobs(jobs.filter((job) => job.id !== id))
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Backup Jobs</CardTitle>
          <CardDescription>Manage your scheduled backup jobs</CardDescription>
        </div>
        <Link href="/jobs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Job
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.name}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                    {job.source}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Cloud className="mr-2 h-4 w-4 text-muted-foreground" />
                    {job.destination}
                  </div>
                </TableCell>
                <TableCell>{job.schedule}</TableCell>
                <TableCell>{formatDate(job.lastRun)}</TableCell>
                <TableCell>{getStatusBadge(job.status)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Play className="mr-2 h-4 w-4" />
                        Run Now
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(job.id)}>
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

