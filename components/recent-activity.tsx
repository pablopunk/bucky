import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, FileArchive, XCircle } from "lucide-react"

// Mock data for demonstration
const mockActivities = [
  {
    id: "act-1",
    jobName: "Website Backup",
    timestamp: "2023-10-15T00:00:00Z",
    status: "success",
    message: "Backup completed successfully",
  },
  {
    id: "act-2",
    jobName: "Database Backup",
    timestamp: "2023-10-15T00:00:00Z",
    status: "success",
    message: "Backup completed successfully",
  },
  {
    id: "act-3",
    jobName: "User Files Backup",
    timestamp: "2023-10-01T00:00:00Z",
    status: "failed",
    message: "Permission denied: cannot access source directory",
  },
  {
    id: "act-4",
    jobName: "Configuration Backup",
    timestamp: "2023-10-13T00:00:00Z",
    status: "running",
    message: "Backup in progress",
  },
  {
    id: "act-5",
    jobName: "Website Backup",
    timestamp: "2023-10-14T00:00:00Z",
    status: "success",
    message: "Backup completed successfully",
  },
  {
    id: "act-6",
    jobName: "Database Backup",
    timestamp: "2023-10-14T00:00:00Z",
    status: "success",
    message: "Backup completed successfully",
  },
]

interface RecentActivityProps {
  limit?: number
}

export function RecentActivity({ limit = 10 }: RecentActivityProps) {
  const activities = mockActivities.slice(0, limit)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
      case "running":
        return <Clock className="h-5 w-5 text-blue-500 dark:text-blue-400" />
      default:
        return <FileArchive className="h-5 w-5 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-4 rounded-lg border border-border p-3 bg-card">
          <div className="mt-0.5">{getStatusIcon(activity.status)}</div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium leading-none">{activity.jobName}</p>
              {activity.status === "success" && (
                <Badge className="bg-green-500 dark:bg-green-600 text-white">Success</Badge>
              )}
              {activity.status === "failed" && <Badge variant="destructive">Failed</Badge>}
              {activity.status === "running" && (
                <Badge className="bg-blue-500 dark:bg-blue-600 text-white">Running</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{activity.message}</p>
            <p className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

