import { Dialog, DialogContent } from "@/components/ui/dialog"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImagePreviewModalProps {
  image: File | null
  onClose: () => void
  index?: number
}

export function ImagePreviewModal({ image, onClose, index }: ImagePreviewModalProps) {
  if (!image) return null

  return (
    <Dialog open={!!image} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] p-0">
        <div className="relative">
          <img
            src={URL.createObjectURL(image) || "/placeholder.svg"}
            alt={`image_${(index ?? 0) + 1}`}
            className="w-full h-auto max-h-[80vh] object-contain"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-background/50 hover:bg-background/80"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="p-4 bg-background">
          <p className="text-sm font-medium">image_{(index ?? 0) + 1}</p>
          <p className="text-sm text-muted-foreground">{(image.size / 1024).toFixed(2)} kB</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

