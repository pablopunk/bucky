"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BarChart, Cloud, FileArchive, Home, Mail, Settings } from "lucide-react"

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    title: "Backup Jobs",
    href: "/jobs",
    icon: FileArchive,
  },
  {
    title: "Storage",
    href: "/storage",
    icon: Cloud,
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Mail,
  },
  {
    title: "Logs",
    href: "/logs",
    icon: BarChart,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function SideNav() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-16 flex-col items-center border-r border-border bg-card py-4 md:w-60">
      <div className="flex h-14 items-center px-4 md:h-16">
        <Link href="/" className="flex items-center gap-2">
          <FileArchive className="h-6 w-6" />
          <span className="hidden text-xl font-bold md:inline-block">Bucky</span>
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2 py-4 w-full">
        {navItems.map((item) => (
          <Button
            key={item.href}
            variant={pathname === item.href ? "secondary" : "ghost"}
            className={cn("w-full justify-start", pathname === item.href ? "bg-secondary" : "")}
            asChild
          >
            <Link href={item.href}>
              <item.icon className="mr-2 h-5 w-5" />
              <span className="hidden md:inline-block">{item.title}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}

