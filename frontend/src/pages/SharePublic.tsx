import ChatLayout from "../layouts/ChatLayout"
import { useChatContext } from "../context/ChatContext"
import { useEffect, useRef, useState } from "react"
import { ChatNav } from "@/components/nav/ChatNav"
import { findToolCall } from "@/lib/utils/format"
import { useNavigate, useParams } from "react-router-dom"
import ChatMessages from "@/components/lists/ChatMessages"
import { findThread } from "@/services/threadService"

export default function ThreadPublic() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const {
    messages,
    isToolCallInProgress,
    currentToolCall,
    setSelectedToolMessage,
    setMessages,
    setPayload
  } = useChatContext()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [loading, setLoading] = useState(false)

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

    fetchThread()
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
              {loading ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <ChatMessages messages={messages} />
              )}
              <div ref={messagesEndRef} /> {/* Invisible element to scroll to */}
            </div>
          </div>
        </div>
      </div>
    </ChatLayout>
  )
}

