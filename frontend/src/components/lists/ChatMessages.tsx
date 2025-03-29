import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import MarkdownCard from "../cards/MarkdownCard";
import { Wrench } from "lucide-react";
import SystemMessageCard from "../cards/SystemMessageCard";
import { useToolContext } from "@/context/ToolContext";
import { useEffect, useRef, useState } from "react";
import { ChatDrawer } from "../drawers/ChatDrawer";
import SearchEngineTool from "../tools/SearchEngine";
import DefaultTool from "../tools/Default";
import { useChatContext } from "@/context/ChatContext";


const ChatMessages = ({ messages }: { messages: any[] }) => {
	const prevThreadIdRef = useRef();
	const [, setCurrentThreadId] = useState<string | null>(null)
  const {
    isAssistantOpen,
    setIsAssistantOpen,
  } = useToolContext();
	const {
		payload,
		currentToolCall,
		isToolCallInProgress,
		setIsToolCallInProgress,
		setCurrentToolCall,
	} = useChatContext();
	const [selectedToolMessage, setSelectedToolMessage] = useState<any>(null)

  if (messages.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-muted-foreground">No messages yet</p>
      </div>
    )
  }

	const handleDrawerClose = () => {
    setIsAssistantOpen(false)
    setSelectedToolMessage(null)
    setIsToolCallInProgress(false)
    setCurrentToolCall(null)
  }

	useEffect(() => {
    if (isToolCallInProgress && currentToolCall) {
      setSelectedToolMessage(currentToolCall)
      setIsAssistantOpen(true)
    }
  }, [isToolCallInProgress, currentToolCall])

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
    <div className="flex flex-col gap-2">
      {messages.map((message, index: number) => {
        if (message.type === "tool") {
					return (
						<div key={index} className="flex justify-start">
							<div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 p-3 rounded-lg rounded-bl-sm">
								<div className="flex items-center">
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setSelectedToolMessage(message)
											setIsAssistantOpen(true)
										}}
										className="flex items-center gap-2"
									>
										<Wrench className="h-4 w-4" />
										{message.name}
										<span
											className={cn(
												"text-xs px-2 py-0.5 rounded-full",
												message.status === "success"
													? "bg-green-500/20 text-green-500"
													: "bg-red-500/20 text-red-500",
											)}
										>
											{message.status}
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
			<ChatDrawer isOpen={isAssistantOpen} onClose={handleDrawerClose}>
          {selectedToolMessage ? (
            <>
              {selectedToolMessage.name === 'search_engine' ? (
                <SearchEngineTool selectedToolMessage={selectedToolMessage} />
              ) : selectedToolMessage.name === 'available_tools' ? (
                <DefaultTool selectedToolMessage={selectedToolMessage} />
              ) : (
                <DefaultTool selectedToolMessage={selectedToolMessage} />
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary">AI</span>
                </div>
                <div>
                  <h3 className="font-medium">GPT-4</h3>
                  <p className="text-sm text-muted-foreground">Our most capable model</p>
                </div>
              </div>

              <div className="prose prose-sm dark:prose-invert">
                <p>The current model can:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Analyze complex problems</li>
                  <li>Generate creative content</li>
                  <li>Handle detailed conversations</li>
                  <li>Process and explain code</li>
                </ul>
              </div>
            </div>
          )}
        </ChatDrawer>
    </div>
  )
}
export default ChatMessages