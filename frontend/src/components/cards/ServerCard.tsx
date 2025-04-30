import { Server } from "@/entities"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ServerCardProps {
  server: Server
}

// Format date helper function
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date)
}

export function ServerCard({ server }: ServerCardProps) {
  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{server.name}</CardTitle>
          <Badge variant={server.public ? "default" : "secondary"}>
            {server.public ? "Public" : "Private"}
          </Badge>
        </div>
        <CardDescription>{server.description || "No description provided"}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Type:</span>
            <Badge variant="outline">{server.type}</Badge>
          </div>
          {server.config && (
            <div className="text-sm">
              <div className="font-medium">Configuration:</div>
              <div className="text-muted-foreground">
                <div>URL: {server.config.url}</div>
                <div>Transport: {server.config.transport}</div>
              </div>
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-4">
            Created: {formatDate(server.created_at || new Date().toISOString())}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 