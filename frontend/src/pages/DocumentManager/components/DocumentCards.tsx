import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { Document } from "../types"

interface DocumentCardsProps {
  documents: Document[]
}

export function DocumentCards({ documents }: DocumentCardsProps) {
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
        <div key={index} className="rounded-lg border p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-medium line-clamp-2 flex-1 mr-2">{doc.name}</h3>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Collection:</span>
              <span>{doc.collection}</span>
            </div>
            <div className="flex justify-between">
              <span>Date Uploaded:</span>
              <span>{doc.dateUploaded}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 