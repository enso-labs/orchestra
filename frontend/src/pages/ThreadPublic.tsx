import ChatLayout from "../layouts/ChatLayout"
import { useChatContext } from "../context/ChatContext"
import MarkdownCard from "../components/cards/MarkdownCard"
import { Button } from "@/components/ui/button"
import { useEffect, useRef, useState } from "react"
import { ChatNav } from "@/components/nav/ChatNav"
import SystemMessageCard from "@/components/cards/SystemMessageCard"
import { ChatDrawer } from "@/components/drawers/ChatDrawer"
import { Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import ChatInput from "@/components/inputs/ChatInput"
import DefaultTool from "@/components/tools/Default"
import SearchEngineTool from "@/components/tools/SearchEngine"
import { findToolCall } from "@/lib/utils/format"
import { useNavigate } from "react-router-dom"
import ChatMessages from "@/components/lists/ChatMessages"

interface ChatMessage {
  role: string
  content: string
  type: string
  name?: string
  status?: string
  tool_calls?: any[]
}

function ToolAction({ selectedToolMessage }: { selectedToolMessage: any}) {
  if (selectedToolMessage) return (
    <>
      {selectedToolMessage.name === 'search_engine' ? (
        <SearchEngineTool selectedToolMessage={selectedToolMessage} />
      ) : selectedToolMessage.name === 'available_tools' ? (
        <DefaultTool selectedToolMessage={selectedToolMessage} />
      ) : (
        <DefaultTool selectedToolMessage={selectedToolMessage} />
      )}
    </>
  )
}

export default function ThreadPublic() {
  const navigate = useNavigate();
  const {
    messages,
    payload,
    isToolCallInProgress,
    setIsToolCallInProgress,
    currentToolCall,
    setCurrentToolCall,
    currentModel,
    setSelectedToolMessage
  } = useChatContext()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)

  const [, setCurrentThreadId] = useState<string | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]) // Scroll when messages change

  useEffect(() => {
    if (currentToolCall) {
      const foundToolCall = findToolCall(currentToolCall, messages)
      setSelectedToolMessage(foundToolCall)
      setIsAssistantOpen(true)
    }
  }, [isToolCallInProgress, currentToolCall])

  const handleDrawerClose = () => {
    setIsAssistantOpen(false)
    setSelectedToolMessage(null)
    setIsToolCallInProgress(false)
    setCurrentToolCall(null)
  }

  const prevThreadIdRef = useRef()

  useEffect(() => {
    // Only perform the check if we have a previous value
    if (prevThreadIdRef.current !== undefined) {
      if (payload.threadId && payload.threadId !== prevThreadIdRef.current) {
        handleDrawerClose()
      }
    }

    // Update the ref and state
    prevThreadIdRef.current = payload.threadId
    setCurrentThreadId(payload.threadId || null)
  }, [payload.threadId])

  return (
    <ChatLayout>
      <div
        className={`
						flex min-h-[calc(100vh-0px)] max-h-[calc(100vh-0px)] relative
						transition-all duration-200 ease-in-out
						${isAssistantOpen ? "pr-[var(--chat-drawer-width,320px)]" : ""}
				`}
      >
        {/* <ThreadHistoryDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} /> */}

        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatNav
            onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)}
            onNewChat={() => navigate('/')}
          />
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            <div className="space-y-4 max-w-4xl mx-auto pb-4">
              {!messages.find((message: ChatMessage) => message.type === "system") && currentModel?.metadata?.system_message && (
                <SystemMessageCard content={payload.system} />
              )}
              <ChatMessages messages={messages} />
              <div ref={messagesEndRef} /> {/* Invisible element to scroll to */}
            </div>
          </div>

          <div className="sticky bottom-0 bg-background border-border">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col gap-2 p-4 pb-25">
                <ChatInput />
              </div>
            </div>
          </div>
        </div>

        <ChatDrawer isOpen={isAssistantOpen} onClose={handleDrawerClose}>
          {currentToolCall && <ToolAction selectedToolMessage={currentToolCall} />}
        </ChatDrawer>
      </div>
    </ChatLayout>
  )
}

