"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Save, Upload } from "lucide-react"
import { useTheme } from "next-themes"
import { ThemeToggle } from "@/components/theme-toggle"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [settings, setSettings] = useState({
    dataDirectory: "/var/lib/bucky",
    logLevel: "info",
    retentionDays: "30",
    maxConcurrentJobs: "3",
    enableLogging: true,
    darkMode: false,
  })

  // Update darkMode setting when theme changes
  useEffect(() => {
    if (mounted) {
      setSettings((prev) => ({
        ...prev,
        darkMode: theme === "dark",
      }))
    }
  }, [theme, mounted])

  // Update theme when darkMode setting changes
  useEffect(() => {
    if (mounted && settings.darkMode) {
      setTheme("dark")
    } else if (mounted && !settings.darkMode) {
      setTheme("light")
    }
  }, [settings.darkMode, setTheme, mounted])

  // Ensure component is mounted before rendering to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSaveSettings = () => {
    // In a real app, this would save the settings
    console.log(settings)
  }

  const handleExportSettings = () => {
    // In a real app, this would export the settings to a file
    console.log("Exporting settings")
  }

  const handleImportSettings = () => {
    // In a real app, this would import settings from a file
    console.log("Importing settings")
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Configure application settings</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={handleExportSettings}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={handleImportSettings}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button onClick={handleSaveSettings}>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </div>
        </div>
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="docker">Docker</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure basic application settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="data-directory">Data Directory</Label>
                  <Input
                    id="data-directory"
                    value={settings.dataDirectory}
                    onChange={(e) => setSettings({ ...settings, dataDirectory: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="log-level">Log Level</Label>
                    <Select
                      value={settings.logLevel}
                      onValueChange={(value) => setSettings({ ...settings, logLevel: value })}
                    >
                      <SelectTrigger id="log-level">
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
                  <div className="space-y-2">
                    <Label htmlFor="retention-days">Retention Days</Label>
                    <Input
                      id="retention-days"
                      type="number"
                      value={settings.retentionDays}
                      onChange={(e) => setSettings({ ...settings, retentionDays: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-logging"
                    checked={settings.enableLogging}
                    onCheckedChange={(checked) => setSettings({ ...settings, enableLogging: checked })}
                  />
                  <Label htmlFor="enable-logging">Enable Logging</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="dark-mode"
                    checked={settings.darkMode}
                    onCheckedChange={(checked) => setSettings({ ...settings, darkMode: checked })}
                  />
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>Configure advanced application settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="max-concurrent-jobs">Max Concurrent Jobs</Label>
                  <Input
                    id="max-concurrent-jobs"
                    type="number"
                    value={settings.maxConcurrentJobs}
                    onChange={(e) => setSettings({ ...settings, maxConcurrentJobs: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rclone-config">Rclone Configuration</Label>
                  <Textarea id="rclone-config" placeholder="Paste your rclone.conf content here" rows={10} />
                  <p className="text-sm text-muted-foreground">
                    This configuration will be used to connect to remote storage providers
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="docker" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Docker Configuration</CardTitle>
                <CardDescription>Docker deployment settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <h3 className="mb-2 text-sm font-medium">docker-compose.yml</h3>
                  <pre className="text-xs bg-muted-foreground/10 p-2 rounded overflow-x-auto">
                    {`version: '3'
services:
  bucky:
    image: bucky/backup-manager:latest
    container_name: bucky
    volumes:
      - ./data:/var/lib/bucky
      - ./config:/etc/bucky
      - /path/to/backup:/source:ro
    environment:
      - TZ=UTC
      - BUCKY_LOG_LEVEL=info
    ports:
      - "3000:3000"
    restart: unless-stopped`}
                  </pre>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docker-volumes">Additional Volumes</Label>
                  <Textarea id="docker-volumes" placeholder="Enter additional volumes to mount" rows={3} />
                  <p className="text-sm text-muted-foreground">Format: /host/path:/container/path:ro</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docker-env">Environment Variables</Label>
                  <Textarea id="docker-env" placeholder="Enter additional environment variables" rows={3} />
                  <p className="text-sm text-muted-foreground">Format: VARIABLE=value</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

