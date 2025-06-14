import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { X, Wand2 } from "lucide-react"
import PromptGenerator from "./PromptGenerator";
import { GenerateMode } from "../types";

interface FullscreenEditorProps {
  isVisible: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  showPromptGenerator: boolean;
  onTogglePromptGenerator: () => void;
  onGeneratePrompt: (mode: GenerateMode, description: string) => void;
  isGenerating: boolean;
}

export default function FullscreenEditor({
  isVisible,
  onClose,
  value,
  onChange,
  showPromptGenerator,
  onTogglePromptGenerator,
  onGeneratePrompt,
  isGenerating
}: FullscreenEditorProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Edit System Message</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onTogglePromptGenerator}
            title="Generate system prompt"
          >
            <Wand2 className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {showPromptGenerator && (
        <div className="mb-4">
          <PromptGenerator
            onGenerate={onGeneratePrompt}
            onCancel={onTogglePromptGenerator}
            isGenerating={isGenerating}
          />
        </div>
      )}

      <Textarea
        placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
        className="flex-1 resize-none h-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={!showPromptGenerator}
      />
    </div>
  );
} 