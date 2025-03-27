import type React from "react"
import "@/app/globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { SideNav } from "@/components/side-nav"
import { Toaster } from "sonner"
import type { Metadata } from "next"
import { getBreeScheduler, initializeScheduler, shutdownScheduler } from "@/lib/backup"
import { closeAllDatabases } from "@/lib/db"

const inter = Inter({ subsets: ["latin"] })

// Initialize scheduler only once on server
let schedulerInitialized = false

// Ensure the scheduler is initialized in server components
if (typeof window === 'undefined' && !schedulerInitialized) {
  schedulerInitialized = true;
  
  // Only initialize on the server-side to avoid duplicate initialization
  try {
    console.log('Initializing Bree backup scheduler...');
    initializeScheduler()
      .then(() => console.log('Bree scheduler initialized successfully'))
      .catch(error => console.error('Failed to initialize Bree scheduler:', error));
      
    // Handle graceful shutdown
    const cleanup = async () => {
      console.log('Application shutting down, cleaning up resources...');
      try {
        await shutdownScheduler();
        closeAllDatabases();
        console.log('Cleanup completed successfully');
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    };
    
    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('Received SIGINT signal');
      await cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM signal');
      await cleanup();
      process.exit(0);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await cleanup();
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Failed to initialize Bree scheduler:', error);
  }
}

export const metadata: Metadata = {
  title: "Bucky Backup Manager",
  description: "Manage your backups with ease",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <div className="flex min-h-screen flex-col md:flex-row bg-background text-foreground">
            <SideNav />
            <div className="flex-1">{children}</div>
          </div>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}



