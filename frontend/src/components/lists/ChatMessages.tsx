import { useEffect, useRef, useState } from "react";
import { Loader2, Wrench, Copy, Edit } from "lucide-react";

import { useAppContext } from "@/context/AppContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import MarkdownCard from "../cards/MarkdownCard";
import DefaultTool from "../tools/Default";
import { cn } from "@/lib/utils";
import { truncateFrom } from "@/lib/utils/format";
// import { useChatContext } from "@/context/ChatContext";
import SearchEngineTool from "../tools/SearchEngine";

const MAX_LENGTH = 1000;

function isValidJSON(str: string): boolean {
	try {
		JSON.parse(str);
		return true;
	} catch {
		return false;
	}
}

function ToolAction({
	message,
	maxLength = MAX_LENGTH,
}: {
	message: any;
	maxLength?: number;
}) {
	if (["search_engine", "web_search"].includes(message.name)) {
		return <SearchEngineTool selectedToolMessage={message} />;
	}

	// Check if message.content is valid JSON
	if (
		message.content &&
		typeof message.content === "string" &&
		isValidJSON(message.content)
	) {
		return <DefaultTool selectedToolMessage={message} collapsed={true} />;
	}

	return (
		<MarkdownCard
			content={truncateFrom(message.content, "end", "...", maxLength)}
		/>
	);
}

export function Message({ message }: { message: any }) {
	const ICON_SIZE = 4;
	const [isEditing, setIsEditing] = useState(false);

	if (["human", "user"].includes(message.role)) {
		return (
			<div key={message.id} className="p-2 rounded-md justify-end">
				<div className="flex justify-end">
					<div
						className={`max-w-[80%] md:max-w-[70%] bg-primary/90 text-primary-foreground px-4 rounded-xl rounded-br-sm relative cursor-pointer ${
							isEditing ? "pb-5" : "py-0"
						}`}
						onClick={() => setIsEditing(!isEditing)}
					>
						<MarkdownCard
							content={message.content || message.content[0].text}
						/>
						{isEditing && (
							<div className="flex absolute bottom-1 right-1">
								<button
									className="p-1 rounded hover:bg-muted transition-colors"
									onClick={() => {
										navigator.clipboard.writeText(message.content);
										console.log(message);
										alert("Copied to clipboard (User Message)");
									}}
								>
									<Copy
										className={`h-${ICON_SIZE} w-${ICON_SIZE} hover:text-foreground`}
									/>
								</button>
								<button
									className="p-1 rounded hover:bg-muted transition-colors"
									onClick={(e) => {
										e.stopPropagation();
										alert("Edit");
									}}
								>
									<Edit
										className={`h-${ICON_SIZE} w-${ICON_SIZE} hover:text-foreground`}
									/>
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	if (["tool"].includes(message.role || message.type)) {
		return (
			<div className="group">
				<div className="max-w-[90vw] md:max-w-[80%] rounded-lg rounded-bl-sm">
					<div key={message.id} className="p-2 rounded bg-gray-800 m-2">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-2">
								<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
									<Wrench className="h-4 w-4 text-primary" />
								</div>
								<h3
									className={cn(
										"text-xs px-2 py-0.5 rounded-full",
										message.status === "success"
											? "bg-green-500/20 text-green-500"
											: "bg-red-500/20 text-red-500",
									)}
								>
									{message.name}
								</h3>
								<p className="text-xs text-muted-foreground">
									{message.tool_call_id}
								</p>
							</div>
						</div>
						<div className="overflow-y-auto mt-2">
							<div className="bg-transparent text-foreground px-2 rounded-lg rounded-bl-sm max-h-[200px] overflow-y-auto">
								<ToolAction
									message={message}
									// maxLength={maxLength}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (["ai", "assistant"].includes(message.role)) {
		return (
			<div className="group">
				<div className="max-w-[90vw] md:max-w-[80%] rounded-lg rounded-bl-sm">
					<div className="bg-transparent text-foreground-500 px-3 rounded-lg rounded-bl-sm">
						<MarkdownCard
							content={
								message.content || message.content[0]?.text || "Invalid message"
							}
						/>
					</div>
				</div>
				<div className="flex justify-start opacity-100 transition-opacity duration-200 mt-1 px-3">
					<div className="flex gap-1">
						<button className="p-1 rounded hover:bg-muted transition-colors">
							<Copy
								className={`h-${ICON_SIZE} w-${ICON_SIZE} text-muted-foreground hover:text-foreground`}
								onClick={() => {
									navigator.clipboard.writeText(
										message.content || message.content[0].text,
									);
									alert("Copied to clipboard (AI Message)");
								}}
							/>
						</button>

						<button className="text-sm text-muted-foreground">
							{message.model}
						</button>
					</div>
				</div>
			</div>
		);
	}

	if (["AIMessageChunk"].includes(message.role || message.type)) {
		return (
			<div className="group">
				<div className="max-w-[90vw] md:max-w-[80%] px-2 rounded-lg rounded-bl-sm">
					<DefaultTool selectedToolMessage={message} collapsed={false} />
				</div>
			</div>
		);
	}

	return <p>{message.content || JSON.stringify(message.input)}</p>;
}

const ChatMessages = ({ messages }: { messages: any[] }) => {
	const { loading, loadingMessage } = useAppContext();
	const bottomRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom of messages when messages change
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	if (messages.length === 0) {
		return (
			<div className="flex justify-center items-center h-full">
				<p className="text-muted-foreground">No messages yet</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full min-h-0 overflow-hidden">
			<ScrollArea className="flex-1 h-0 p-1">
				<div className="max-w-4xl mx-auto pb-4 px-5">
					{messages.length > 0 ? (
						messages.map((message: any) => (
							<Message key={message.id} message={message} />
						))
					) : (
						<div className="pt-4 text-center text-muted-foreground">
							<p>No messages yet</p>
							<p className="text-sm mt-2">
								Start a conversation by typing in the input field above.
							</p>
						</div>
					)}
					{loading && (
						<div className="flex justify-start p-3">
							<Loader2 className="h-5 w-5 animate-spin mx-2" />
							<span className="text-muted-foreground">{loadingMessage}</span>
						</div>
					)}
					<div ref={bottomRef} />
				</div>
			</ScrollArea>
		</div>
	);
};
export default ChatMessages;
