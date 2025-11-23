import { useEffect, useRef, useState } from "react";
import { Loader2, Edit, Check, X } from "lucide-react";

import { useAppContext } from "@/context/AppContext";
import { useChatContext } from "@/context/ChatContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import MarkdownCard from "../cards/MarkdownCard";
import DefaultTool from "../tools/Default";
import { formatContent } from "@/lib/utils/format";
import CopyTextButton from "../buttons/CopyTextButton";
import FileViewer from "../viewers/FileViewer";
import { latestHumanMessage } from "@/lib/utils/message";
import ToolTimeline from "../timeline/ToolTimeline";


export function Message({
	message,
	isLatest = false,
	messages,
}: {
	message: any;
	isLatest?: boolean;
	messages: any[];
}) {
	const ICON_SIZE = 4;
	const [isEditing, setIsEditing] = useState(false);
	const [isEditingText, setIsEditingText] = useState(false);
	const [editedContent, setEditedContent] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { loading } = useAppContext();
	const { streamingRate, handleSubmit } = useChatContext();

	// Auto-resize textarea
	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setEditedContent(e.target.value);
		// Auto-resize
		e.target.style.height = "auto";
		e.target.style.height = `${e.target.scrollHeight}px`;
	};

	// Handle edit mode activation
	const handleEditClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsEditingText(true);
		setEditedContent(formatContent(message.content));
		// Focus textarea after state update
		setTimeout(() => {
			if (textareaRef.current) {
				textareaRef.current.focus();
				textareaRef.current.style.height = "auto";
				textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
			}
		}, 0);
	};

	// Handle save
	const handleSave = async (e: React.MouseEvent) => {
		e.stopPropagation();
		// TODO: Implement save functionality to persist edited message
		console.log("Saving edited message:", editedContent);
		await handleSubmit(editedContent);
		setIsEditingText(false);
		setIsEditing(false);
	};

	// Handle cancel
	const handleCancel = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsEditingText(false);
		setEditedContent("");
	};

	// Handle keyboard shortcuts
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSave(e as any);
		} else if (e.key === "Escape") {
			e.preventDefault();
			handleCancel(e as any);
		}
	};

	if (["human", "user"].includes(message.type ?? message.role)) {
		return (
			<div key={message.id} className="p-2 rounded-md justify-end">
				<div className="flex justify-end">
					<div
						className={`max-w-[80%] md:max-w-[70%] bg-primary/90 text-primary-foreground px-4 rounded-xl rounded-br-sm relative ${
							isEditingText ? "pb-8" : isEditing ? "pb-5" : "py-0"
						} ${!isEditingText ? "cursor-pointer" : ""}`}
						onClick={() => !isEditingText && setIsEditing(!isEditing)}
					>
						{isEditingText ? (
							<textarea
								ref={textareaRef}
								value={editedContent}
								onChange={handleTextareaChange}
								onKeyDown={handleKeyDown}
								onClick={(e) => e.stopPropagation()}
								className="w-full resize-none overflow-y-auto min-h-[48px] max-h-[200px] py-2 bg-transparent text-primary-foreground focus:outline-none rounded-lg"
								rows={1}
							/>
						) : (
							<MarkdownCard content={formatContent(message.content)} />
						)}
						{isEditing && !isEditingText && (
							<div className="flex absolute bottom-1 right-1">
								<CopyTextButton text={formatContent(message.content)} />
								<button
									className="p-1 rounded hover:bg-muted transition-colors"
									onClick={handleEditClick}
								>
									<Edit
										className={`h-${ICON_SIZE} w-${ICON_SIZE} hover:text-foreground`}
									/>
								</button>
							</div>
						)}
						{isEditingText && (
							<div className="flex gap-1 absolute bottom-1 right-1">
								<button
									className="p-1 rounded hover:bg-green-500/20 transition-colors"
									onClick={handleSave}
									title="Save (Enter)"
								>
									<Check
										className={`h-${ICON_SIZE} w-${ICON_SIZE} text-green-500 hover:text-green-400`}
									/>
								</button>
								<button
									className="p-1 rounded hover:bg-red-500/20 transition-colors"
									onClick={handleCancel}
									title="Cancel (Esc)"
								>
									<X
										className={`h-${ICON_SIZE} w-${ICON_SIZE} text-red-500 hover:text-red-400`}
									/>
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	if ('input' in message) {
		return (
			<div className="group">
				<div className="max-w-[90vw] md:max-w-[80%] px-2 rounded-lg rounded-bl-sm">
					<DefaultTool selectedToolMessage={message} collapsed={true} />
				</div>
			</div>
		);
	}

	if (["tool"].includes(message.type ?? message.role)) {
		return (
			<div className="group">
				<div className="max-w-[90vw] md:max-w-[80%] rounded-lg rounded-bl-sm m-2">
					<ToolTimeline messages={[message]} />
				</div>
			</div>
		);
	}

	const { filesMap, viewMode } = useChatContext();
	const messageFiles = filesMap.get(message.id);

	return (
		<div className="group">
			<div className="max-w-[90vw] md:max-w-[80%] rounded-lg rounded-bl-sm">
				<div className="bg-transparent text-foreground-500 px-3 rounded-lg rounded-bl-sm">
					<MarkdownCard
						content={formatContent(message.content) || "Invalid message"}
					/>
				</div>

				{viewMode === "chat" &&
					messageFiles &&
					Object.keys(messageFiles).length > 0 && (
						<div className="mt-2 px-3">
							<FileViewer files={messageFiles} />
						</div>
					)}
			</div>
			<div className="flex justify-start opacity-100 transition-opacity duration-200 mt-1 px-3">
				<div className="flex gap-1">
					<CopyTextButton text={formatContent(message.content)} />

					<div className="flex items-center gap-2">
						<button className="text-sm text-muted-foreground">
							{message.model ||
								latestHumanMessage(messages)?.model ||
								"Unknown model"}
						</button>

						{isLatest && streamingRate?.rate && (
							<span
								className={`text-sm text-muted-foreground/70 ${loading ? "animate-pulse" : ""}`}
							>
								{streamingRate.rate} tok/s • {streamingRate.count} tokens
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
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
						messages.map((message: any, index: number) => (
							<Message
								key={message.id}
								message={message}
								isLatest={index === messages.length - 1}
								messages={messages}
							/>
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
