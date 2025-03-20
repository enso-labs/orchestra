import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useChatContext } from "@/context/ChatContext"
import { optimizeSystemPrompt } from "@/services/threadService"

export default function SystemMessage({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localContent, setLocalContent] = useState(content)
  const { payload, setPayload } = useChatContext()
  const [showPromptGenerator, setShowPromptGenerator] = useState(false)
  const [promptDescription, setPromptDescription] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    setLocalContent(content)
  }, [content])

  const handleContentChange = (value: string) => {
    setLocalContent(value)
    setPayload({ ...payload, system: value })
  }

  const handleGeneratePrompt = async () => {
    if (!promptDescription.trim()) return;
    
    setIsGenerating(true);
    try {
      const result = await optimizeSystemPrompt({
        ...payload,
        query: promptDescription
      });
      
      if (result) {
        handleContentChange(result);
        setIsExpanded(true);
      }
      setShowPromptGenerator(false);
      setPromptDescription("");
    } catch (error) {
      console.error("Failed to generate system prompt:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-foreground/10 text-foreground-500 p-3 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400">SYSTEM</div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-500"
            onClick={() => setShowPromptGenerator(!showPromptGenerator)}
            title="Generate system prompt"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-500"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {showPromptGenerator && (
        <div className="absolute top-10 left-0 z-10 w-full bg-background border rounded-md shadow-md p-3">
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium">Describe what you want the AI to do</div>
            <input
              type="text"
              className="w-full p-2 border rounded text-sm"
              placeholder="e.g., Act as a JavaScript expert"
              value={promptDescription}
              onChange={(e) => setPromptDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGeneratePrompt()}
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowPromptGenerator(false)}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleGeneratePrompt}
                disabled={isGenerating || !promptDescription.trim()}
              >
                {isGenerating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`text-sm ${!isExpanded ? "line-clamp-2" : ""}`}>
        <textarea
          className="w-full resize-none bg-transparent focus:outline-none"
          rows={isExpanded ? 5 : 1}
          value={localContent}
          onChange={(e) => handleContentChange(e.target.value)}
        />
      </div>
    </div>
  )
}