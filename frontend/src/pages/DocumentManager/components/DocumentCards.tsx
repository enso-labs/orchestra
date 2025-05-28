import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Trash2 } from "lucide-react"
import { Document } from "../types"

interface DocumentCardsProps {
  documents: Document[]
  onDeleteDocument?: (collectionId: string, documentId: string) => void
}

export function DocumentCards({ documents, onDeleteDocument }: DocumentCardsProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  if (documents.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">No documents found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {documents.map((doc, index) => (
        <div key={doc.uuid || index} className="rounded-lg border p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-medium line-clamp-2 flex-1 mr-2">
              {doc.metadata.source || doc.metadata.filename}
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => onDeleteDocument?.(doc.collection_id, doc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>No. of Pages:</span>
              <span>{doc.metadata.total_pages}</span>
            </div>
            <div className="flex justify-between">
              <span>Date Uploaded:</span>
              <span>{formatDate(doc.metadata.creationdate)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 