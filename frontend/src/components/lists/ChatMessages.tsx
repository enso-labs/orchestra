import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import MarkdownCard from "../cards/MarkdownCard";
import { Wrench, Loader2 } from "lucide-react";
import SystemMessageCard from "../cards/SystemMessageCard";
import { useEffect, useState } from "react";
import SearchEngineTool from "../tools/SearchEngine";
import DefaultTool from "../tools/Default";
import { useToolContext } from "@/context/ToolContext";
import { truncateFrom } from "@/lib/utils/format";
import { useAppContext } from "@/context/AppContext";


const ChatMessages = ({ messages }: { messages: any[] }) => {
	const [selectedToolId, setSelectedToolId] = useState<number | null>(null);
	const { selectedToolMessage } = useToolContext();
	const { loading, loadingMessage } = useAppContext();

	useEffect(() => {
		if (selectedToolMessage) {
			console.log(selectedToolMessage);
		}
	}, [selectedToolMessage]);

	const handleToolClick = (index: number) => {
		setSelectedToolId(selectedToolId === index ? null : index);
	}

	const renderTool = (index: number) => {
		return Boolean(selectedToolId === index || selectedToolMessage);
	}

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
						<div key={index} className="flex flex-col">
							<div 
								className={cn(
									"border rounded-lg overflow-hidden",
									renderTool(index) 
										? "w-full bg-muted/50 shadow-sm" 
										: "min-w-[100px] max-w-[250px] bg-transparent"
								)}
							>
								<Button
									variant="ghost"
									onClick={() => handleToolClick(index)}
									className={cn(
										"flex items-center gap-3 p-3 rounded-none hover:bg-accent",
										renderTool(index) 
											? "w-full justify-between border-b" 
											: "w-full justify-between"
									)}
								>
									<div className="flex items-center gap-2">
										<Wrench className="h-4 w-4" />
										<span className="truncate">{truncateFrom(message.name, "end", "...", 20)}</span>
									</div>
									<span
										className={cn(
											"text-xs px-2 py-0.5 rounded-full flex-shrink-0",
											message.status === "success"
												? "bg-green-500/20 text-green-500"
												: "bg-red-500/20 text-red-500",
										)}
									>
										{message.status}
									</span>
								</Button>
								
								{renderTool(index) && (
									<div className="max-h-[600px] w-full overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-muted">
										<div className="p-4">
											{message.name === 'search_engine' ? (
												<SearchEngineTool selectedToolMessage={message} />
											) : message.name === 'available_tools' ? (
												<DefaultTool selectedToolMessage={message} />
											) : (
												<DefaultTool selectedToolMessage={message} />
											)}
										</div>
									</div>
								)}
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
				// } else if (message.role === "system" || message.type === "system") {
				// 	return <SystemMessageCard key={index} content={message.content} />
				} else if (
					message.role === "assistant" ||
					message.type === "assistant" ||
					message.role === "ai" ||
					(message.type === "ai" && message.tool_calls && !(message.tool_calls.length > 0))
				) {
					return (
						<div key={index} className="flex justify-start">
							<div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 px-3 rounded-lg rounded-bl-sm">
								<MarkdownCard content={message.content} />
							</div>
						</div>
					) 
				}
			})}
			{loading && (
				<div className="flex justify-start h-full mt-2">
					<Loader2 className="h-5 w-5 animate-spin mx-2" />
					<span className="text-muted-foreground">{loadingMessage}</span>
				</div>
			)}
		</div>
	)
}
export default ChatMessages