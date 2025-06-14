import ChatLayout from "../layouts/ChatLayout"
import { useChatContext } from "../context/ChatContext"
import { useEffect, useRef, useState } from "react"
import { ChatNav } from "@/components/nav/ChatNav"
import { ChatDrawer } from "@/components/drawers/ChatDrawer"
import ChatInput from "@/components/inputs/ChatInput"
import DefaultTool from "@/components/tools/Default"
import SearchEngineTool from "@/components/tools/SearchEngine"
import { findToolCall } from "@/lib/utils/format"
import { useNavigate, useParams } from "react-router-dom"
import ChatMessages from "@/components/lists/ChatMessages"
import { findThread } from "@/lib/services/threadService"

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
  const { threadId } = useParams();
  const {
    messages,
    payload,
    isToolCallInProgress,
    setIsToolCallInProgress,
    currentToolCall,
    setCurrentToolCall,
    setSelectedToolMessage,
    setMessages,
    setPayload,
  } = useChatContext()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [, setLoading] = useState(false)

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

  // Fetch thread data from API when component mounts
  useEffect(() => {
    const fetchThread = async () => {
      if (threadId) {
        setLoading(true)
        try {
          const response = await findThread(threadId)
          if (response?.data) {
            // Set thread data in context
            setMessages(response.data.messages || [])
            setPayload((prev: any) => ({ ...prev, threadId: threadId }))
          }
        } catch (error) {
          console.error("Error fetching thread:", error)
        } finally {
          setLoading(false)
        }
      }
    }

    fetchThread();
  }, [threadId])

  return (
    <ChatLayout>
      <div
        className={`
						flex min-h-[calc(100vh-0px)] max-h-[calc(100vh-0px)] relative
						transition-all duration-200 ease-in-out
						${isAssistantOpen ? "pr-[var(--chat-drawer-width,320px)]" : ""}
				`}
      >

        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatNav
            onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)}
            onNewChat={() => {
              setMessages([]);
              setPayload((prev: any) => ({ ...prev, threadId: '', query: '' }));
              navigate('/');
            }}
          />
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

