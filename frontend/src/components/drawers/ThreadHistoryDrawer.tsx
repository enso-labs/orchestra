import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/context/AppContext";
import { useChatContext } from "@/context/ChatContext";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { formatMessages, truncateFrom } from "@/lib/utils/format";
import { Link } from "react-router-dom";
import { searchThreads } from "@/lib/services/threadService";
import { SettingsPopover } from "@/components/popovers/SettingsPopover";
import { useState } from "react";
import { StringParam, useQueryParam } from "use-query-params";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";

interface ThreadHistoryDrawerProps {
	isOpen: boolean;
	onClose: () => void;
}

export function ThreadHistoryDrawer({
	isOpen,
	onClose,
}: ThreadHistoryDrawerProps) {
	const { setIsDrawerOpen } = useAppContext();
	const {
		threads,
		metadata,
		setMessages,
		setMetadata,
		deleteThread,
		setThreads,
	} = useChatContext();
	const [, setQueryModel] = useQueryParam("model", StringParam);
	const [copiedThreadId, setCopiedThreadId] = useState<string | null>(null);

	const metadataCopy = JSON.parse(metadata);

	const handleDeleteClick = async (e: React.MouseEvent, threadId: string) => {
		e.stopPropagation(); // Prevent thread selection when clicking delete

		if (window.confirm("Are you sure you want to delete this thread?")) {
			try {
				const deleted = await deleteThread(threadId);
				if (deleted) {
					setThreads(threads.filter((thread: any) => thread.key !== threadId));
				}
			} catch (error) {
				alert("Failed to delete thread");
			}
		}
	};

	return (
		<>
			{/* Overlay for mobile - only shows when drawer is open */}
			{isOpen && (
				<div
					className="fixed inset-0 bg-black/50 z-30 md:hidden"
					onClick={onClose}
				/>
			)}

			<div
				className={`
        absolute md:relative w-[300px] border-r border-border flex flex-col h-[calc(100vh-0px)]
        ${isOpen ? "flex" : "hidden md:flex"}
        bg-background z-40
      `}
			>
				<div className="p-4 border-b border-border">
					<Link to="/" className="flex items-center gap-2">
						<img
							src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
							alt="Logo"
							className="w-8 h-8 rounded-full"
						/>
						<h1 className="text-2xl font-bold text-foreground">Ensō</h1>
					</Link>
				</div>

				<ScrollArea className="flex-1">
					<div className="p-2 space-y-2">
						{threads &&
							threads.length > 0 &&
							threads.map((thread: any) => {
								const config = thread.value;
								const messages = thread.value.messages;
								const lastMessage = messages[messages.length - 1];
								const lastMessageContent =
									typeof lastMessage.content === "string"
										? lastMessage.content
										: (lastMessage.content[0]?.text ?? "");
								return (
									<div key={config.thread_id} className="group relative">
										<button
											onClick={async () => {
												const checkpoint = await searchThreads(
													"list_checkpoints",
													config,
												);
												setQueryModel(
													thread.value.messages[
														thread.value.messages.length - 1
													].model || DEFAULT_CHAT_MODEL,
												);
												setMessages(
													formatMessages(checkpoint[0].values.messages),
												);
												setMetadata(JSON.stringify(thread.value));
												setIsDrawerOpen(false);
											}}
											className={`w-full text-left p-3 rounded-lg transition-colors border ${
												metadataCopy.thread_id === thread.value.thread_id
													? "bg-accent border-accent"
													: "hover:bg-accent/50 border-border"
											}`}
										>
											<div className="w-full pr-8">
												<p className="text-sm font-medium line-clamp-2 max-w-60">
													{lastMessageContent
														? truncateFrom(lastMessageContent, "end", "...", 70)
														: "no content found"}
												</p>
												<div className="flex justify-between items-center mt-1">
													<p className="text-xs text-muted-foreground truncate">
														{formatDistanceToNow(new Date(thread.updated_at), {
															addSuffix: true,
														})}
													</p>
													<div className="flex items-center gap-1">
														<p
															className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
															onClick={(e) => {
																e.stopPropagation();
																navigator.clipboard.writeText(
																	thread.value.thread_id,
																);
																setCopiedThreadId(thread.value.thread_id);
																setTimeout(() => setCopiedThreadId(null), 2000);
															}}
															title="Click to copy thread ID"
														>
															{thread.value.thread_id}
														</p>
														{copiedThreadId === thread.value.thread_id && (
															<svg
																xmlns="http://www.w3.org/2000/svg"
																className="h-3 w-3 text-green-500"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M5 13l4 4L19 7"
																/>
															</svg>
														)}
													</div>
												</div>
											</div>
										</button>
										<Button
											variant="ghost"
											size="icon"
											className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={(e) => handleDeleteClick(e, thread.key)}
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="h-4 w-4 text-muted-foreground hover:text-destructive"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</Button>
									</div>
								);
							})}
					</div>
				</ScrollArea>

				<div className="p-4 border-t border-border">
					<SettingsPopover />
				</div>
			</div>
		</>
	);
}
