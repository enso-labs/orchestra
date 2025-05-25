import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"

interface Document {
  name: string
  collection: string
  dateUploaded: string
}

interface DocumentCardProps {
  document: Document
}

export function DocumentCard({ document }: DocumentCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium line-clamp-2 flex-1 mr-2">{document.name}</h3>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Collection:</span>
          <span>{document.collection}</span>
        </div>
        <div className="flex justify-between">
          <span>Date Uploaded:</span>
          <span>{document.dateUploaded}</span>
        </div>
      </div>
    </div>
  )
} 