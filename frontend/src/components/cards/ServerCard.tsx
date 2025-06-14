import { Server } from "@/lib/entities"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PencilIcon, Eye } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

interface ServerCardProps {
  server: Server,
  editable?: boolean,
  onEdit?: (id: string) => void,
  onDelete?: (id: string) => void,
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
  const navigate = useNavigate();

  return (
    <Card className="hover:bg-accent/50 transition-colors flex flex-col h-full">
      <CardHeader className="space-y-1 p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{server.name}</CardTitle>
          <div className="flex items-center space-x-1">
            <Badge variant={server.public ? "default" : "secondary"}>
              {server.public ? "Public" : "Private"}
            </Badge>
          </div>
        </div>
        <CardDescription>{server.description || "No description provided"}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow px-4">
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
        </div>
      </CardContent>
      <CardFooter className="mt-auto px-4">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-muted-foreground">
            Created: {formatDate(server.created_at || new Date().toISOString())}
          </div>
          <div className="flex items-center">
            <button
              className="p-1.5 rounded-md hover:bg-secondary/80 text-muted-foreground"
              aria-label="Edit server"
              onClick={() => navigate(`/server/${server.id}/edit`)}
            >
              <PencilIcon className="h-5 w-5" />
            </button>
            <Link
              to={`/server/${server.slug}`}
              className="p-1.5 rounded-md hover:bg-primary/10 text-primary"
              aria-label="View server"
            >
              <Eye className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
} 