import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Trash2 } from "lucide-react"
import { Document } from "../types"

interface DocumentTableProps {
  documents: Document[]
  onDeleteDocument?: (collectionId: string, documentId: string) => void
  collectionId: string
}

export function DocumentTable({ documents, onDeleteDocument, collectionId }: DocumentTableProps) {
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
    <div className="rounded-lg border overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1.5fr_auto] gap-4 p-4 bg-muted border-b text-sm font-medium">
        <div>Document Name</div>
        <div>No. of Pages</div>
        <div>Date Uploaded</div>
        <div className="w-10"></div>
      </div>

      {documents.map((doc, index) => (
        <div
          key={doc.uuid || index}
          className="grid grid-cols-[2fr_1fr_1.5fr_auto] gap-4 p-4 border-b last:border-b-0 hover:bg-muted/50"
        >
          <div className="text-sm truncate font-medium">{doc.metadata.source || doc.metadata.filename}</div>
          <div className="text-sm text-muted-foreground">{doc.metadata.total_pages}</div>
          <div className="text-sm text-muted-foreground">{formatDate(doc.metadata.creationdate)}</div>
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
        </div>
      ))}
    </div>
  )
} 