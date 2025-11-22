import { useChatContext } from "@/context/ChatContext";
import { Button } from "@/components/ui/button";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";
import {
	deleteThread,
	searchThreads,
	searchThreadsByProject,
} from "@/lib/services/threadService";
import { formatMessages, truncateFrom } from "@/lib/utils/format";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import useModel from "@/hooks/useModel";

interface ListProjectThreadsProps {
	projectId: string;
}

function ListProjectThreads({ projectId }: ListProjectThreadsProps) {
	const { setMessages, setMetadata, metadata, setCheckpoints } =
		useChatContext();
	const { setModel } = useModel();
	const [threads, setThreads] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchThreads = async () => {
			if (!projectId) return;
			setLoading(true);
			try {
				const result = await searchThreadsByProject(projectId);
				setThreads(result);
			} catch (error) {
				console.error("Failed to fetch project threads:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchThreads();
	}, [projectId, metadata.thread_id]);

	if (loading) {
		return (
			<div className="flex justify-center items-center py-8">
				<p className="text-muted-foreground">Loading threads...</p>
			</div>
		);
	}

	if (threads.length === 0) {
		return (
			<div className="flex justify-center items-center py-8">
				<p className="text-muted-foreground">
					No conversations yet. Start chatting above!
				</p>
			</div>
		);
	}

	const handleDeleteClick = async (e: React.MouseEvent, threadId: string) => {
		e.stopPropagation();

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
		<div className="space-y-2">
			{threads.map((thread) => {
				const config = thread.value;
				const messages = thread.value.messages;
				const lastMessage = messages[messages.length - 1];
				const lastMessageContent =
					typeof lastMessage?.content === "string"
						? lastMessage.content
						: (lastMessage?.content?.[0]?.text ?? "");

				const handleThreadClick = async () => {
					const checkpoints = await searchThreads("list_checkpoints", config);
					setModel(
						thread.value.messages[thread.value.messages.length - 1]?.model ||
							DEFAULT_CHAT_MODEL,
					);
					setCheckpoints(checkpoints);
					setMessages(formatMessages(checkpoints[0].values.messages));
					setMetadata(thread.value);
				};

				return (
					<div key={config.thread_id} className="group relative">
						<button
							onClick={handleThreadClick}
							className={`w-full text-left p-3 rounded-lg transition-colors border ${
								metadata.thread_id === thread.value.thread_id
									? "bg-accent border-accent"
									: "hover:bg-accent/50 border-border"
							}`}
						>
							<div className="w-full pr-8">
								<p className="text-sm font-medium line-clamp-2">
									{lastMessageContent
										? truncateFrom(lastMessageContent, "end", "...", 70)
										: "No content found"}
								</p>
								<div className="flex justify-between items-center mt-1 gap-2">
									<p className="text-xs text-muted-foreground truncate">
										{formatDistanceToNow(new Date(thread.updated_at), {
											addSuffix: true,
										})}
									</p>
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
	);
}

export default ListProjectThreads;
