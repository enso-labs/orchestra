import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/context/AppContext";
import { useChatContext } from "@/context/ChatContext";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { formatMessages, truncateFrom } from "@/lib/utils/format";
import { Link } from "react-router-dom";
import { searchThreads } from "@/lib/services/threadService";
import { SettingsPopover } from "@/components/popovers/SettingsPopover";

interface ThreadHistoryDrawerProps {
	isOpen: boolean;
	onClose: () => void;
}

export function ThreadHistoryDrawer({
	isOpen,
	onClose,
}: ThreadHistoryDrawerProps) {
	const { setIsDrawerOpen } = useAppContext();
	const { threads, metadata, setMessages, setMetadata } = useChatContext();

	const metadataCopy = JSON.parse(metadata);

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
								return (
									<div key={config.thread_id} className="group relative">
										<button
											onClick={async () => {
												const checkpoint = await searchThreads(
													"get_checkpoint",
													config,
												);
												setMessages(formatMessages(checkpoint.messages));
												setMetadata(JSON.stringify(thread.value));
												setIsDrawerOpen(false);
											}}
											className={`w-full text-left p-3 rounded-lg transition-colors border ${
												metadataCopy.thread_id === thread.thread_id
													? "bg-accent border-accent"
													: "hover:bg-accent/50 border-border"
											}`}
										>
											<div className="w-full pr-8">
												<p className="text-sm font-medium line-clamp-2 max-w-60">
													{lastMessage.content
														? truncateFrom(
																lastMessage.content,
																"end",
																"...",
																70,
															)
														: "no content found"}
												</p>
												<p className="text-xs text-muted-foreground mt-1 truncate">
													{formatDistanceToNow(new Date(thread.updated_at), {
														addSuffix: true,
													})}
												</p>
											</div>
										</button>
										<Button
											variant="ghost"
											size="icon"
											className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
											// onClick={(e) => handleDeleteClick(e, thread.thread_id)}
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
