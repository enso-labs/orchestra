import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useChatContext } from "@/context/ChatContext"

export default function SystemMessage({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localContent, setLocalContent] = useState(content)
  const { payload, setPayload } = useChatContext()

  useEffect(() => {
    setLocalContent(content)
  }, [content])

  const handleContentChange = (value: string) => {
    setLocalContent(value)
    setPayload({ ...payload, system: value })
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-foreground/10 text-foreground-500 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">SYSTEM</div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-500"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
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