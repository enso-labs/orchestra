import ChatLayout from "../layouts/ChatLayout"
import { useChatContext } from "../context/ChatContext"
import MarkdownCard from "../components/cards/MarkdownCard"
import { Button } from "@/components/ui/button"
import { ThreadHistoryDrawer } from "@/components/drawers/ThreadHistoryDrawer"
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

export default function Chat() {
  const {
    messages,
    payload,
    useGetHistoryEffect,
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

  useGetHistoryEffect()

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
        <ThreadHistoryDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatNav
            onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)}
            // onAssistantClick={() => setIsAssistantOpen(!isAssistantOpen)}
          />
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            <div className="space-y-4 max-w-4xl mx-auto pb-4">
              {!messages.find((message: ChatMessage) => message.type === "system") && currentModel?.metadata?.system_message && (
                <SystemMessageCard content={payload.system} />
              )}
              {messages?.map((message: any, index: number) => {
                if (message.type === "tool" || message.role === "tool") {

                  const lastToolCall = !message.tool_calls ? message : message.tool_calls[message.tool_calls.length - 1];
                  return (
                    <div key={index} className="flex justify-start">
                      <div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 p-3 rounded-lg rounded-bl-sm">
                        <div className="flex items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentToolCall(lastToolCall)}
                            className="flex items-center gap-2"
                          >
                            <Wrench className="h-4 w-4" />
                            {message.name || lastToolCall.name}
                            <span
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                message.status === "success" || lastToolCall.status === "success"
                                  ? "bg-green-500/20 text-green-500"
                                  : "bg-red-500/20 text-red-500",
                              )}
                            >
                              {message.status || lastToolCall.status}
                            </span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                } else if (message.role === "user" || message.role === "human" || message.type === "human") {
                  return (
                    <div key={index} className="flex justify-end">
                      <div className="max-w-[80%] md:max-w-[70%] bg-primary/90 text-primary-foreground p-3 rounded-lg rounded-br-sm">
                        <MarkdownCard content={message.content} />
                      </div>
                    </div>
                  )
                } else if (message.role === "system" || message.type === "system") {
                  return <SystemMessageCard key={index} content={message.content} />
                } else if (
                  message.role === "assistant" ||
                  message.type === "assistant" ||
                  message.role === "ai" ||
                  (message.type === "ai" && message.tool_calls && !(message.tool_calls.length > 0))
                ) {
                  return (
                    <div key={index} className="flex justify-start">
                      <div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 p-3 rounded-lg rounded-bl-sm">
                        <MarkdownCard content={message.content} />
                      </div>
                    </div>
                  )
                }
              })}
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

