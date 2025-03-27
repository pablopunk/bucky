"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { LoadingState } from "@/components/ui/loading-state"
import { ErrorState } from "@/components/ui/error-state"

interface AppSettings {
  dataDirectory: string
  backupDirectory: string
  maxConcurrentJobs: number
  retentionPeriod: number
  compressionLevel: number
  enableLogging: boolean
  logLevel: "debug" | "info" | "warn" | "error"
  autoUpdateCheck: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    dataDirectory: "",
    backupDirectory: "",
    maxConcurrentJobs: 3,
    retentionPeriod: 30,
    compressionLevel: 6,
    enableLogging: true,
    logLevel: "info",
    autoUpdateCheck: true,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (!response.ok) {
        throw new Error("Failed to fetch settings")
      }
      const data = await response.json()
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error("Failed to save settings")
      }

      toast.success("Settings saved successfully")
    } catch (err) {
      console.error("Error saving settings:", err)
      toast.error("Failed to save settings")
    }
  }

  if (loading) {
    return <LoadingState message="Loading Settings..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => { fetchSettings(); }} />
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure application settings</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic application configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dataDirectory">Data Directory</Label>
                <Input
                  id="dataDirectory"
                  value={settings.dataDirectory}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      dataDirectory: e.target.value,
                    }))
                  }
                  placeholder="/path/to/data"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backupDirectory">Backup Directory</Label>
                <Input
                  id="backupDirectory"
                  value={settings.backupDirectory}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      backupDirectory: e.target.value,
                    }))
                  }
                  placeholder="/path/to/backups"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxConcurrentJobs">Max Concurrent Jobs</Label>
                <Input
                  id="maxConcurrentJobs"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentJobs}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      maxConcurrentJobs: parseInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retentionPeriod">Retention Period (days)</Label>
                <Input
                  id="retentionPeriod"
                  type="number"
                  min="1"
                  value={settings.retentionPeriod}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      retentionPeriod: parseInt(e.target.value),
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Performance and debugging options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="compressionLevel">Compression Level</Label>
                <Select
                  value={settings.compressionLevel.toString()}
                  onValueChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      compressionLevel: parseInt(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select compression level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1 (Fastest)</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="6">Level 6 (Default)</SelectItem>
                    <SelectItem value="9">Level 9 (Best)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Logging</Label>
                  <p className="text-sm text-muted-foreground">
                    Save detailed logs of backup operations
                  </p>
                </div>
                <Switch
                  checked={settings.enableLogging}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableLogging: checked,
                    }))
                  }
                />
              </div>

              {settings.enableLogging && (
                <div className="space-y-2">
                  <Label htmlFor="logLevel">Log Level</Label>
                  <Select
                    value={settings.logLevel}
                    onValueChange={(value) =>
                      setSettings((prev) => ({
                        ...prev,
                        logLevel: value as "debug" | "info" | "warn" | "error",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select log level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Update Check</Label>
                  <p className="text-sm text-muted-foreground">
                    Check for application updates automatically
                  </p>
                </div>
                <Switch
                  checked={settings.autoUpdateCheck}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      autoUpdateCheck: checked,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveSettings}>Save Settings</Button>
        </div>
      </main>
    </div>
  )
}

