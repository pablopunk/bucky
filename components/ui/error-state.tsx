import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "./button"

interface ErrorStateProps {
  error: string
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h3 className="text-xl font-semibold mt-2">Something went wrong</h3>
      </div>
      
      <div className="max-w-md">
        <p className="text-muted-foreground mb-4">{error}</p>
        
        {onRetry && (
          <Button onClick={onRetry} variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        )}
      </div>
    </div>
  )
} 