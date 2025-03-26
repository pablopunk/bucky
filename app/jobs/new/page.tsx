"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Folder, HelpCircle } from "lucide-react"

export default function NewBackupJobPage() {
  const [jobName, setJobName] = useState("")
  const [sourceDir, setSourceDir] = useState("")
  const [cronExpression, setCronExpression] = useState("0 0 * * *")
  const [storageProvider, setStorageProvider] = useState("")
  const [destinationPath, setDestinationPath] = useState("")
  const [emailNotifications, setEmailNotifications] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, this would create the backup job
    console.log({
      jobName,
      sourceDir,
      cronExpression,
      storageProvider,
      destinationPath,
      emailNotifications,
    })
    // Redirect to jobs list
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
          <h1 className="text-2xl font-bold tracking-tight">Create New Backup Job</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Settings</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Settings</CardTitle>
                  <CardDescription>Configure the source and destination for your backup job</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="job-name">Job Name</Label>
                    <Input
                      id="job-name"
                      placeholder="My Backup Job"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source-dir">Source Directory</Label>
                    <div className="flex gap-2">
                      <Input
                        id="source-dir"
                        placeholder="/path/to/source"
                        value={sourceDir}
                        onChange={(e) => setSourceDir(e.target.value)}
                        required
                        className="flex-1"
                      />
                      <Button variant="outline" type="button">
                        <Folder className="mr-2 h-4 w-4" />
                        Browse
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storage-provider">Storage Provider</Label>
                    <Select value={storageProvider} onValueChange={setStorageProvider} required>
                      <SelectTrigger id="storage-provider">
                        <SelectValue placeholder="Select a storage provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local Storage</SelectItem>
                        <SelectItem value="storj">Storj</SelectItem>
                        <SelectItem value="s3">Amazon S3</SelectItem>
                        <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                        <SelectItem value="azure">Azure Blob Storage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination-path">Destination Path</Label>
                    <Input
                      id="destination-path"
                      placeholder="storj:my-bucket/backups"
                      value={destinationPath}
                      onChange={(e) => setDestinationPath(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule</CardTitle>
                  <CardDescription>Configure when your backup job should run</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cron-expression">Cron Expression</Label>
                      <Button variant="link" size="sm" className="h-auto p-0">
                        <HelpCircle className="mr-1 h-3 w-3" />
                        Help with cron
                      </Button>
                    </div>
                    <Input
                      id="cron-expression"
                      placeholder="0 0 * * *"
                      value={cronExpression}
                      onChange={(e) => setCronExpression(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Default: Daily at midnight (0 0 * * *)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Common Schedules</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" type="button" onClick={() => setCronExpression("0 0 * * *")}>
                        Daily (Midnight)
                      </Button>
                      <Button variant="outline" type="button" onClick={() => setCronExpression("0 0 * * 0")}>
                        Weekly (Sunday)
                      </Button>
                      <Button variant="outline" type="button" onClick={() => setCronExpression("0 0 1 * *")}>
                        Monthly (1st)
                      </Button>
                      <Button variant="outline" type="button" onClick={() => setCronExpression("0 0 * * 1-5")}>
                        Weekdays
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Configure email notifications for this backup job</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <Switch
                      id="email-notifications"
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  {emailNotifications && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="notification-email">Email Address</Label>
                        <Input id="notification-email" type="email" placeholder="admin@example.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Notification Triggers</Label>
                        <div className="grid gap-2">
                          <div className="flex items-center space-x-2">
                            <Switch id="notify-success" defaultChecked />
                            <Label htmlFor="notify-success">Successful backups</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="notify-failure" defaultChecked />
                            <Label htmlFor="notify-failure">Failed backups</Label>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          <div className="mt-4 flex justify-end gap-2">
            <Link href="/jobs">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit">Create Backup Job</Button>
          </div>
        </form>
      </main>
    </div>
  )
}

