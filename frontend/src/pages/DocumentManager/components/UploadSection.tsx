import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

interface UploadSectionProps {
  onFileSelect?: () => void
}

export function UploadSection({ onFileSelect }: UploadSectionProps) {
  return (
    <div className="border-2 border-dashed rounded-lg p-8 md:p-12 text-center">
      <Upload className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-sm text-muted-foreground mb-4">Drag and drop files here or click to browse</p>
      <Button variant="outline" className="text-sm" onClick={onFileSelect}>
        Select Files
      </Button>
    </div>
  )
} 