"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface SMTPConfig {
  host: string
  port: number
  username: string
  password: string
  fromEmail: string
  fromName: string
}

interface NotificationSettings {
  onSuccess: boolean
  onFailure: boolean
  onQuotaWarning: boolean
  quotaThreshold: number
}

export default function NotificationsPage() {
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    host: "",
    port: 587,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
  })

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    onSuccess: true,
    onFailure: true,
    onQuotaWarning: true,
    quotaThreshold: 90,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSMTPConfig()
    fetchNotificationSettings()
  }, [])

  const fetchSMTPConfig = async () => {
    try {
      const response = await fetch("/api/smtp")
      if (!response.ok) {
        throw new Error("Failed to fetch SMTP configuration")
      }
      const data = await response.json()
      setSmtpConfig(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const fetchNotificationSettings = async () => {
    try {
      const response = await fetch("/api/notifications/settings")
      if (!response.ok) {
        throw new Error("Failed to fetch notification settings")
      }
      const data = await response.json()
      setNotificationSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const saveSMTPConfig = async () => {
    try {
      const response = await fetch("/api/smtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(smtpConfig),
      })

      if (!response.ok) {
        throw new Error("Failed to save SMTP configuration")
      }

      toast.success("SMTP configuration saved successfully")
    } catch (err) {
      console.error("Error saving SMTP config:", err)
      toast.error("Failed to save SMTP configuration")
    }
  }

  const saveNotificationSettings = async () => {
    try {
      const response = await fetch("/api/notifications/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notificationSettings),
      })

      if (!response.ok) {
        throw new Error("Failed to save notification settings")
      }

      toast.success("Notification settings saved successfully")
    } catch (err) {
      console.error("Error saving notification settings:", err)
      toast.error("Failed to save notification settings")
    }
  }

  const testEmailConnection = async () => {
    try {
      const response = await fetch("/api/smtp/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(smtpConfig),
      })

      if (!response.ok) {
        throw new Error("Failed to test email connection")
      }

      toast.success("Test email sent successfully")
    } catch (err) {
      console.error("Error testing email connection:", err)
      toast.error("Failed to send test email")
    }
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Configure email notifications</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>SMTP Configuration</CardTitle>
              <CardDescription>Configure your email server settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="host">SMTP Host</Label>
                <Input
                  id="host"
                  value={smtpConfig.host}
                  onChange={(e) =>
                    setSmtpConfig((prev) => ({ ...prev, host: e.target.value }))
                  }
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">SMTP Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) =>
                    setSmtpConfig((prev) => ({
                      ...prev,
                      port: parseInt(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={smtpConfig.username}
                  onChange={(e) =>
                    setSmtpConfig((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) =>
                    setSmtpConfig((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromEmail">From Email</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={smtpConfig.fromEmail}
                  onChange={(e) =>
                    setSmtpConfig((prev) => ({
                      ...prev,
                      fromEmail: e.target.value,
                    }))
                  }
                  placeholder="backups@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  value={smtpConfig.fromName}
                  onChange={(e) =>
                    setSmtpConfig((prev) => ({
                      ...prev,
                      fromName: e.target.value,
                    }))
                  }
                  placeholder="Backup System"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveSMTPConfig}>Save Configuration</Button>
                <Button variant="outline" onClick={testEmailConnection}>
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure when to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Successful Backups</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when backups complete successfully
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.onSuccess}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      onSuccess: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Failed Backups</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when backups fail
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.onFailure}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      onFailure: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Storage Quota Warnings</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when storage quota is near limit
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.onQuotaWarning}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      onQuotaWarning: checked,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Quota Warning Threshold (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={notificationSettings.quotaThreshold}
                  onChange={(e) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      quotaThreshold: parseInt(e.target.value),
                    }))
                  }
                />
              </div>
              <Button onClick={saveNotificationSettings}>Save Settings</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

