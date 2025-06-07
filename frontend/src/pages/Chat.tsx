import ChatLayout from "../layouts/ChatLayout"
import { useChatContext } from "../context/ChatContext"
import { ThreadHistoryDrawer } from "@/components/drawers/ThreadHistoryDrawer"
import { useEffect, useRef, useState } from "react"
import { ChatNav } from "@/components/nav/ChatNav"
import { ChatDrawer } from "@/components/drawers/ChatDrawer"
import ChatInput from "@/components/inputs/ChatInput"
import DefaultTool from "@/components/tools/Default"
import SearchEngineTool from "@/components/tools/SearchEngine"
import { findToolCall } from "@/lib/utils/format"
import ChatMessages from "@/components/lists/ChatMessages"
import HomeSection from "@/components/sections/home"
import { ColorModeButton } from "@/components/buttons/ColorModeButton"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import SelectModel from "@/components/selects/SelectModel"
import { useAgentContext } from "@/context/AgentContext"
// import SystemMessageCard from "@/components/cards/SystemMessageCard"

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
    // currentModel,
    setSelectedToolMessage
  } = useChatContext()
  const { useEffectGetAgents } = useAgentContext();
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

  useEffectGetAgents();

  if (messages.length === 0) {
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

          <div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
            <div className="absolute top-4 left-4">
              <Button 
                  onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                  variant="outline"
                  size="icon"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <div className="absolute top-4 right-4">
              <div className="flex flex-row gap-2 items-center">
                <SelectModel />
                <div className="flex-shrink-0">
                  <ColorModeButton />
                </div>
              </div>
            </div>
            <HomeSection />
          </div>
        </div>
      </ChatLayout>
    )
  }

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
          <ChatNav onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)} />
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            <div className="space-y-4 max-w-4xl mx-auto pb-4">
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

function useEffectGetAgents() {
  throw new Error("Function not implemented.")
}

