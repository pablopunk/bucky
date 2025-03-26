"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mail, Send } from "lucide-react"

export default function NotificationsPage() {
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [emailSettings, setEmailSettings] = useState({
    smtpServer: "smtp.example.com",
    smtpPort: "587",
    username: "notifications@example.com",
    password: "password",
    fromAddress: "backups@example.com",
    toAddress: "admin@example.com",
  })
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(true)
  const [notifyOnFailure, setNotifyOnFailure] = useState(true)
  const [customTemplate, setCustomTemplate] = useState(
    "Backup job: {{job_name}}\nStatus: {{status}}\nTime: {{timestamp}}\n\n{{message}}",
  )

  const handleSaveSettings = () => {
    // In a real app, this would save the notification settings
    console.log({
      emailEnabled,
      emailSettings,
      notifyOnSuccess,
      notifyOnFailure,
      customTemplate,
    })
  }

  const handleTestEmail = () => {
    // In a real app, this would send a test email
    console.log("Sending test email")
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground">Configure email notifications for backup jobs</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleTestEmail}>
              <Send className="mr-2 h-4 w-4" />
              Test Email
            </Button>
            <Button onClick={handleSaveSettings}>Save Settings</Button>
          </div>
        </div>
        <Tabs defaultValue="email" className="space-y-4">
          <TabsList>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Notifications</CardTitle>
                    <CardDescription>Configure email settings for backup notifications</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="email-enabled">Enable Email</Label>
                    <Switch id="email-enabled" checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-server">SMTP Server</Label>
                        <Input
                          id="smtp-server"
                          placeholder="smtp.example.com"
                          value={emailSettings.smtpServer}
                          onChange={(e) => setEmailSettings({ ...emailSettings, smtpServer: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-port">SMTP Port</Label>
                        <Input
                          id="smtp-port"
                          placeholder="587"
                          value={emailSettings.smtpPort}
                          onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          placeholder="username"
                          value={emailSettings.username}
                          onChange={(e) => setEmailSettings({ ...emailSettings, username: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="password"
                          value={emailSettings.password}
                          onChange={(e) => setEmailSettings({ ...emailSettings, password: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="from-address">From Address</Label>
                        <Input
                          id="from-address"
                          placeholder="backups@example.com"
                          value={emailSettings.fromAddress}
                          onChange={(e) => setEmailSettings({ ...emailSettings, fromAddress: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="to-address">To Address</Label>
                        <Input
                          id="to-address"
                          placeholder="admin@example.com"
                          value={emailSettings.toAddress}
                          onChange={(e) => setEmailSettings({ ...emailSettings, toAddress: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notification Triggers</Label>
                      <div className="grid gap-2">
                        <div className="flex items-center space-x-2">
                          <Switch id="notify-success" checked={notifyOnSuccess} onCheckedChange={setNotifyOnSuccess} />
                          <Label htmlFor="notify-success">Successful backups</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="notify-failure" checked={notifyOnFailure} onCheckedChange={setNotifyOnFailure} />
                          <Label htmlFor="notify-failure">Failed backups</Label>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Templates</CardTitle>
                <CardDescription>Customize the email notification templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-template">Custom Template</Label>
                  <Textarea
                    id="custom-template"
                    placeholder="Enter your custom email template"
                    value={customTemplate}
                    onChange={(e) => setCustomTemplate(e.target.value)}
                    rows={10}
                  />
                  <p className="text-sm text-muted-foreground">
                    Available variables: {`{{job_name}}`}, {`{{status}}`}, {`{{timestamp}}`}, {`{{message}}`}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Preview</h3>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">
                    {customTemplate
                      .replace("{{job_name}}", "Website Backup")
                      .replace("{{status}}", "Success")
                      .replace("{{timestamp}}", new Date().toLocaleString())
                      .replace("{{message}}", "Backup completed successfully")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

