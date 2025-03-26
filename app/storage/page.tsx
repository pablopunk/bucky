"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Cloud, Database, Edit, Plus, RefreshCw, Trash } from "lucide-react"

// Mock data for demonstration
const mockStorageProviders = [
  {
    id: "provider-1",
    name: "Storj Main",
    type: "storj",
    endpoint: "https://gateway.storjshare.io",
    accessKey: "access-key-1",
    secretKey: "••••••••••••••••",
    status: "connected",
  },
  {
    id: "provider-2",
    name: "Local Backup Drive",
    type: "local",
    path: "/mnt/backup",
    status: "connected",
  },
  {
    id: "provider-3",
    name: "S3 Archive",
    type: "s3",
    endpoint: "https://s3.amazonaws.com",
    accessKey: "access-key-2",
    secretKey: "••••••••••••••••",
    status: "disconnected",
  },
]

export default function StoragePage() {
  const [providers, setProviders] = useState(mockStorageProviders)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newProvider, setNewProvider] = useState({
    name: "",
    type: "storj",
    endpoint: "",
    accessKey: "",
    secretKey: "",
  })

  const handleAddProvider = () => {
    const provider = {
      id: `provider-${providers.length + 1}`,
      ...newProvider,
      status: "connected",
    }
    setProviders([...providers, provider])
    setNewProvider({
      name: "",
      type: "storj",
      endpoint: "",
      accessKey: "",
      secretKey: "",
    })
    setIsAddDialogOpen(false)
  }

  const handleDeleteProvider = (id: string) => {
    setProviders(providers.filter((provider) => provider.id !== id))
  }

  const handleTestConnection = (id: string) => {
    // In a real app, this would test the connection to the storage provider
    console.log(`Testing connection to provider ${id}`)
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Storage Providers</h1>
            <p className="text-muted-foreground">Manage your storage providers for backup destinations</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Storage Provider</DialogTitle>
                <DialogDescription>Configure a new storage provider for your backups</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Provider Name</Label>
                  <Input
                    id="name"
                    placeholder="My Storage Provider"
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Provider Type</Label>
                  <Tabs
                    defaultValue="storj"
                    value={newProvider.type}
                    onValueChange={(value) => setNewProvider({ ...newProvider, type: value })}
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="storj">Storj</TabsTrigger>
                      <TabsTrigger value="s3">S3</TabsTrigger>
                      <TabsTrigger value="local">Local</TabsTrigger>
                    </TabsList>
                    <TabsContent value="storj" className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="endpoint">Endpoint</Label>
                        <Input
                          id="endpoint"
                          placeholder="https://gateway.storjshare.io"
                          value={newProvider.endpoint}
                          onChange={(e) => setNewProvider({ ...newProvider, endpoint: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="access-key">Access Key</Label>
                        <Input
                          id="access-key"
                          placeholder="Access Key"
                          value={newProvider.accessKey}
                          onChange={(e) => setNewProvider({ ...newProvider, accessKey: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="secret-key">Secret Key</Label>
                        <Input
                          id="secret-key"
                          type="password"
                          placeholder="Secret Key"
                          value={newProvider.secretKey}
                          onChange={(e) => setNewProvider({ ...newProvider, secretKey: e.target.value })}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="s3" className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="endpoint">Endpoint</Label>
                        <Input
                          id="endpoint"
                          placeholder="https://s3.amazonaws.com"
                          value={newProvider.endpoint}
                          onChange={(e) => setNewProvider({ ...newProvider, endpoint: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="access-key">Access Key</Label>
                        <Input
                          id="access-key"
                          placeholder="Access Key"
                          value={newProvider.accessKey}
                          onChange={(e) => setNewProvider({ ...newProvider, accessKey: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="secret-key">Secret Key</Label>
                        <Input
                          id="secret-key"
                          type="password"
                          placeholder="Secret Key"
                          value={newProvider.secretKey}
                          onChange={(e) => setNewProvider({ ...newProvider, secretKey: e.target.value })}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="local" className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="path">Local Path</Label>
                        <Input
                          id="path"
                          placeholder="/mnt/backup"
                          value={newProvider.endpoint}
                          onChange={(e) => setNewProvider({ ...newProvider, endpoint: e.target.value })}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddProvider}>Add Provider</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Storage Providers</CardTitle>
            <CardDescription>Configure and manage your storage providers</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Endpoint/Path</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {provider.type === "storj" && <Cloud className="mr-2 h-4 w-4 text-blue-500" />}
                        {provider.type === "s3" && <Cloud className="mr-2 h-4 w-4 text-yellow-500" />}
                        {provider.type === "local" && <Database className="mr-2 h-4 w-4 text-green-500" />}
                        {provider.type.charAt(0).toUpperCase() + provider.type.slice(1)}
                      </div>
                    </TableCell>
                    <TableCell>{provider.type === "local" ? provider.path : provider.endpoint}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className={`mr-2 h-2 w-2 rounded-full ${
                            provider.status === "connected" ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        {provider.status.charAt(0).toUpperCase() + provider.status.slice(1)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleTestConnection(provider.id)}>
                          <RefreshCw className="h-4 w-4" />
                          <span className="sr-only">Test Connection</span>
                        </Button>
                        <Button variant="outline" size="icon">
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleDeleteProvider(provider.id)}>
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

