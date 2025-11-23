import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatLayout from "@/layouts/chat-layout-v2";
import { useChatContext } from "@/context/ChatContext";
import { ChatNav } from "@/components/nav/ChatNav";
import ChatInput from "@/components/inputs/ChatInput";
import ChatMessages from "@/components/lists/ChatMessages";
import { useAppContext } from "@/context/AppContext";
import { useAgentContext } from "@/context/AgentContext";
import { useProjectContext } from "@/context/ProjectContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import FileEditorPanel from "@/components/panels/FileEditorPanel";
import { searchThreads } from "@/lib/services/threadService";
import { formatMessages } from "@/lib/utils/format";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";
import useModel from "@/hooks/useModel";

export default function ThreadPage() {
	const { threadId, projectId } = useParams<{
		threadId: string;
		projectId?: string;
	}>();
	const navigate = useNavigate();
	const { loading } = useAppContext();
	const { useEffectGetAgents } = useAgentContext();
	const { selectProject, projects } = useProjectContext();
	const { setModel } = useModel();
	const {
		messages,
		setMessages,
		metadata,
		setMetadata,
		setFilesMap,
		setCheckpoints,
		useEffectUpdateAssistantId,
		useListThreadsEffect,
		useListCheckpointsEffect,
		useModelsEffect,
		viewMode,
		filesMap,
		setTodos,
	} = useChatContext();

	const [threadLoading, setThreadLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useModelsEffect();
	useEffectGetAgents();
	useEffectUpdateAssistantId();
	useListThreadsEffect(!loading);
	useListCheckpointsEffect(!loading, metadata);

	// Load thread data
	useEffect(() => {
		const loadThread = async () => {
			if (!threadId) return;
			setThreadLoading(true);
			setError(null);

			try {
				// Search for the thread to get its data
				const threads = await searchThreads("list_threads", {});
				const thread = threads.find(
					(t: any) => t.value?.thread_id === threadId || t.key === threadId,
				);

				if (!thread) {
					setError("Thread not found");
					return;
				}

				// Load checkpoints for this thread
				const checkpoints = await searchThreads(
					"list_checkpoints",
					thread.value,
				);

				if (!checkpoints || checkpoints.length === 0) {
					setError("No checkpoints found for thread");
					return;
				}

				if (thread.value.todos && Object.keys(thread.value.todos).length > 0) {
					setTodos(thread.value.todos);
				}
				

				// Set filesMap
				if (thread.value.files && Object.keys(thread.value.files).length > 0) {
					const formattedMessages = formatMessages(
						checkpoints[0].values.messages,
					);
					const latestAiMessage = formattedMessages
						.slice()
						.reverse()
						.find((msg: any) => ["ai", "assistant"].includes(msg.role));

					if (latestAiMessage) {
						const newFilesMap = new Map();
						newFilesMap.set(latestAiMessage.id, thread.value.files);
						setFilesMap(newFilesMap);
					}
				} else {
					setFilesMap(new Map());
				}

				// Set model from last message
				const lastMessage =
					thread.value.messages[thread.value.messages.length - 1];
				setModel(lastMessage?.model || DEFAULT_CHAT_MODEL);

				// Set checkpoints, messages, and metadata
				setCheckpoints(checkpoints);
				setMessages(formatMessages(checkpoints[0].values.messages));
				setMetadata(thread.value);
			} catch (err) {
				console.error("Failed to load thread:", err);
				setError("Failed to load thread");
			} finally {
				setThreadLoading(false);
			}
		};

		loadThread();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [threadId]);

	// Handle project context if on /p/:projectId/t/:threadId
	useEffect(() => {
		if (projectId) {
			setMetadata((prev: any) => ({
				...prev,
				project_id: projectId,
			}));
			localStorage.setItem("current_project_id", projectId);

			// Set selectedProject
			const project = projects.find((p: any) => p.id === projectId);
			if (project) {
				selectProject(project);
			}
		}

		return () => {
			if (projectId) {
				setMetadata((prev: any) => {
					const { project_id, ...rest } = prev;
					return rest;
				});
				localStorage.removeItem("current_project_id");
				selectProject(null);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectId, projects]);

	if (threadLoading) {
		return (
			<ChatLayout>
				<div className="flex h-full items-center justify-center">
					<p className="text-muted-foreground">Loading thread...</p>
				</div>
			</ChatLayout>
		);
	}

	if (error) {
		return (
			<ChatLayout>
				<div className="flex h-full flex-col items-center justify-center gap-4">
					<p className="text-muted-foreground">{error}</p>
					<button
						onClick={() => navigate("/chat")}
						className="text-primary hover:underline"
					>
						Go to Chat
					</button>
				</div>
			</ChatLayout>
		);
	}

	return (
		<ChatLayout>
			<div className="flex h-full relative">
				{viewMode === "chat" ? (
					<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
						<ChatNav sidebarTrigger={<SidebarTrigger />} />
						<div className="flex-1 min-h-0">
							<ChatMessages messages={messages} />
						</div>
						<div className="sticky bottom-0 bg-background border-border">
							<div className="max-w-4xl mx-auto">
								<div className="flex flex-col gap-2 px-4 pb-4">
									<ChatInput showAgentMenu={true} />
								</div>
							</div>
						</div>
					</div>
				) : (
					<ResizablePanelGroup direction="horizontal" className="flex-1">
						<ResizablePanel
							defaultSize={60}
							minSize={50}
							maxSize={80}
							className="hidden md:block"
						>
							<FileEditorPanel filesMap={filesMap} />
						</ResizablePanel>

						<ResizableHandle withHandle className="hidden md:flex" />

						<ResizablePanel defaultSize={40} minSize={20} maxSize={50}>
							<div className="flex flex-col h-full min-h-0 overflow-hidden">
								<ChatNav sidebarTrigger={<SidebarTrigger />} />
								<div className="flex-1 min-h-0">
									<ChatMessages messages={messages} />
								</div>
								<div className="sticky bottom-0 bg-background border-border">
									<div className="max-w-4xl mx-auto">
										<div className="flex flex-col gap-2 px-4 pb-4">
											<ChatInput showAgentMenu={true} />
										</div>
									</div>
								</div>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				)}
			</div>
		</ChatLayout>
	);
}
