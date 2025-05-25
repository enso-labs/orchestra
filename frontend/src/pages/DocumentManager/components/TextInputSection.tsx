import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"

interface TextInputSectionProps {
  textContent: string
  onTextChange: (text: string) => void
  onSubmit?: () => void
}

export function TextInputSection({ textContent, onTextChange, onSubmit }: TextInputSectionProps) {
  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Paste or type your text here..."
        value={textContent}
        onChange={(e) => onTextChange(e.target.value)}
        className="min-h-[150px] md:min-h-[200px] resize-none text-sm"
      />
      <Button className="w-full sm:w-auto" onClick={onSubmit}>
        <Plus className="h-4 w-4 mr-2" />
        Add Text Document
      </Button>
    </div>
  )
} 