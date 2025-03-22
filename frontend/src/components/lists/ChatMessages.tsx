import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import MarkdownCard from "../cards/MarkdownCard";
import { Wrench } from "lucide-react";
import { useState } from "react";
import SystemMessageCard from "../cards/SystemMessageCard";

const ChatMessages = ({ messages }: { messages: any[] }) => {

  const [, setIsAssistantOpen] = useState(false)
  const [, setSelectedToolMessage] = useState<any>(null)

  if (messages.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-muted-foreground">No messages yet</p>
      </div>
    )
  }

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
    </div>
  )
}
export default ChatMessages