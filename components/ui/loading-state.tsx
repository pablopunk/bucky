import { Loader2 } from "lucide-react"

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = "Loading data..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground text-lg">{message}</p>
    </div>
  )
} 