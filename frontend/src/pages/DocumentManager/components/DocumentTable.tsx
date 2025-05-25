import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { Document } from "../types"

interface DocumentTableProps {
  documents: Document[]
}

export function DocumentTable({ documents }: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">No documents found</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="grid grid-cols-4 gap-4 p-4 bg-muted border-b text-sm font-medium">
        <div>Document Name</div>
        <div>Collection</div>
        <div>Date Uploaded</div>
        <div>Actions</div>
      </div>

      {documents.map((doc, index) => (
        <div
          key={index}
          className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0 hover:bg-muted/50"
        >
          <div className="text-sm truncate">{doc.name}</div>
          <div className="text-sm text-muted-foreground">{doc.collection}</div>
          <div className="text-sm text-muted-foreground">{doc.dateUploaded}</div>
          <div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
} 