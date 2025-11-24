import { useChatContext } from "@/context/ChatContext";
import { Button } from "@/components/ui/button";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";
import { deleteThread, searchThreads } from "@/lib/services/threadService";
import { formatMessages, truncateFrom } from "@/lib/utils/format";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import { useAgentContext } from "@/context/AgentContext";
import { AxiosResponse } from "axios";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import useModel from "@/hooks/useModel";
import { useThreadContext } from "@/context/ThreadContext";

function ListThreads({ threads }: { threads: any[] }) {
	const { agent } = useAgentContext();
	const { setThreads, setCheckpoints, useListThreadsEffect } =
		useThreadContext();
	const {
		setMessages,
		setMetadata,
		metadata,
	} = useChatContext();
	const { setModel } = useModel();
	const [copiedThreadId] = useState<string | null>(null);
	const [currentThreadCheckpoints, setCurrentThreadCheckpoints] = useState<
		any[]
	>([]);

	useListThreadsEffect(null, { assistant_id: agent.id });

	// Fetch checkpoints only for the currently selected thread
	useEffect(() => {
		const fetchCurrentThreadCheckpoints = async () => {
			if (!metadata.thread_id) {
				setCurrentThreadCheckpoints([]);
				return;
			}

			const selectedThread = threads.find(
				(thread) => thread.value.thread_id === metadata.thread_id,
			);

			if (!selectedThread) {
				setCurrentThreadCheckpoints([]);
				return;
			}

			try {
				const checkpoints = await searchThreads(
					"list_checkpoints",
					selectedThread.value,
				);
				// Filter only input checkpoints as shown in the example
				// const inputCheckpoints = checkpoints.filter(
				// 	(checkpoint: any) => checkpoint.metadata.source === "input",
				// );
				setCurrentThreadCheckpoints(checkpoints);
			} catch (error) {
				console.error(
					`Failed to fetch checkpoints for thread ${metadata.thread_id}:`,
					error,
				);
				setCurrentThreadCheckpoints([]);
			}
		};

		fetchCurrentThreadCheckpoints();
	}, [metadata.thread_id, threads]);

	if (threads.length === 0) {
		return (
			<div className="flex justify-center items-center h-full">
				<p className="text-muted-foreground">No threads found</p>
			</div>
		);
	}

	const handleDeleteClick = async (e: React.MouseEvent, threadId: string) => {
		e.stopPropagation(); // Prevent thread selection when clicking delete

		if (window.confirm("Are you sure you want to delete this thread?")) {
			try {
				let deleted: boolean | AxiosResponse<any, any> = false;
				if (agent.id) {
					deleted = await deleteThread(threadId, agent.id);
				} else {
					deleted = await deleteThread(threadId);
				}
				if (deleted) {
					setThreads(threads.filter((thread: any) => thread.key !== threadId));
				}
			} catch (error) {
				alert("Failed to delete thread");
			}
		}
	};

	return threads.map((thread) => {
		const config = thread.value;
		const messages = thread.value.messages;
		const lastMessage = messages[messages.length - 1];
		const lastMessageContent =
			typeof lastMessage.content === "string"
				? lastMessage.content
				: (lastMessage.content[0]?.text ?? "");

		const isSelected = metadata.thread_id === thread.value.thread_id;
		const checkpointsForThread = isSelected ? currentThreadCheckpoints : [];
		const hasMultipleCheckpoints = checkpointsForThread.length > 1;

		const handleThreadClick = async () => {
			const checkpoints = await searchThreads("list_checkpoints", config);
			setModel(
				thread.value.messages[thread.value.messages.length - 1].model ||
					DEFAULT_CHAT_MODEL,
			);
			setCheckpoints(checkpoints);
			setMessages(formatMessages(checkpoints[0].values.messages));
			setMetadata(thread.value);
			// setIsDrawerOpen(false);
		};

		const handleCheckpointSelect = (checkpointId: string) => {
			const selectedCheckpoint = checkpointsForThread.find(
				(cp: any) => cp.config.configurable.checkpoint_id === checkpointId,
			);
			console.log("Selected checkpoint:", selectedCheckpoint);
			setMessages(formatMessages(selectedCheckpoint.values.messages));
			setMetadata(selectedCheckpoint.config.configurable);
			// setIsDrawerOpen(false);
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
						<p className="text-sm font-medium line-clamp-2 max-w-60">
							{lastMessageContent
								? truncateFrom(lastMessageContent, "end", "...", 70)
								: "no content found"}
						</p>
						<div className="flex justify-between items-center mt-1 gap-2">
							<p className="text-xs text-muted-foreground truncate">
								{formatDistanceToNow(new Date(thread.updated_at), {
									addSuffix: true,
								})}
							</p>
							<div className="flex items-center gap-1">
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
						{isSelected && hasMultipleCheckpoints && (
							<div className="mt-2" onClick={(e) => e.stopPropagation()}>
								<Select onValueChange={handleCheckpointSelect}>
									<SelectTrigger className="h-7 text-xs w-full">
										<SelectValue
											placeholder={`${checkpointsForThread.length} checkpoints`}
										/>
									</SelectTrigger>
									<SelectContent>
										{checkpointsForThread.map(
											(checkpoint: any, index: number) => {
												const checkpointId =
													checkpoint.config.configurable.checkpoint_id;
												const firstMessage = checkpoint.values.messages[0];
												const messageContent =
													typeof firstMessage.content === "string"
														? firstMessage.content
														: (firstMessage.content[0]?.text ?? "");
												const isInput = checkpoint.metadata.source === "input";

												return (
													<SelectItem key={checkpointId} value={checkpointId}>
														<div className="flex flex-col gap-1">
															<div className="flex items-center gap-2">
																<span className="text-xs font-medium">
																	Checkpoint{" "}
																	{checkpointsForThread.length - index}
																</span>
																{isInput && (
																	<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-500 font-medium">
																		input
																	</span>
																)}
															</div>
															<span className="text-xs text-muted-foreground truncate max-w-[200px]">
																{truncateFrom(messageContent, "end", "...", 40)}
															</span>
														</div>
													</SelectItem>
												);
											},
										)}
									</SelectContent>
								</Select>
							</div>
						)}
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
	});
}

export default ListThreads;
