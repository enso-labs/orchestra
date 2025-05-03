import ChatLayout from "../layouts/ChatLayout"
import { useChatContext } from "../context/ChatContext"
import { ThreadHistoryDrawer } from "@/components/drawers/ThreadHistoryDrawer"
import { useEffect, useRef, useState } from "react"
import { ChatNav } from "@/components/nav/ChatNav"
import SystemMessageCard from "@/components/cards/SystemMessageCard"
import { useParams } from "react-router-dom"
import AgentChatInput from "@/components/inputs/AgentChatInput"
import ChatMessages from "@/components/lists/ChatMessages"
import { useToolContext } from "@/context/ToolContext"


interface ChatMessage {
  role: string
  content: string
  type: string
  name?: string
  status?: string
  tool_calls?: any[]
}

export default function Chat() {
	const { agentId } = useParams();
  const {
    isAssistantOpen,
  } = useToolContext();
  const {
    messages,
    payload,
    useGetHistoryEffect,
    currentModel
  } = useChatContext()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]) // Scroll when messages change

  useGetHistoryEffect(agentId)

  return (
    <ChatLayout>
      <div
        className={`
          flex min-h-[calc(100vh-0px)] max-h-[calc(100vh-0px)] relative
          transition-[padding-right] duration-200 ease-in-out
          ${isAssistantOpen ? "pr-[var(--chat-drawer-width,320px)]" : ""}
        `}
      >
        <ThreadHistoryDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatNav
            onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)}
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
                <AgentChatInput agentId={agentId || ''} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChatLayout>
  )
}

