import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import NewThreadButton from "../buttons/NewThreadButton";
import ShareButton from "../buttons/thread-share-button";
import { SaveAsAssistantDialog } from "@/components/dialogs/SaveAsAssistantDialog";
import { History, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import { Button } from "@/components/ui/button";
import AgentService from "@/lib/services/agentService";
import { forkThreadCheckpoint } from "@/lib/services/threadService";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const formatCheckpointTime = (value?: string | null) => {
	if (!value) return "Unknown time";

	try {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return value;
	}
};

export function ChatNav({
	sidebarTrigger,
}: {
	sidebarTrigger?: React.ReactNode | undefined;
}) {
	const { agent, handleGetAgents } = useAgentContext();
	const {
		metadata,
		checkpoints,
		checkpointsLoading,
		checkpointsError,
		threadViewMode,
		previewCheckpoint,
		activeCheckpointId,
		currentThread,
	} = useChatContext();
	const { agentId, projectId } = useParams();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [isForking, setIsForking] = useState(false);
	const threadId = metadata?.thread_id;

	const activePreviewLabel = useMemo(
		() => formatCheckpointTime(previewCheckpoint?.created_at),
		[previewCheckpoint?.created_at],
	);

	const handleSaveAsAssistant = async (name: string, description: string) => {
		try {
			await AgentService.create({
				name,
				description,
				model: agent.model,
				prompt: agent.prompt,
				tools: agent.tools,
				subagents: agent.subagents,
				mcp: agent.mcp,
				a2a: agent.a2a,
				files: agent.files,
			});
			toast.success("Assistant saved successfully");
			await handleGetAgents();
		} catch {
			toast.error("Failed to save assistant");
		}
	};

	const handleSelectCheckpoint = (checkpointId: string) => {
		const next = new URLSearchParams(searchParams);
		next.set("checkpointId", checkpointId);
		setSearchParams(next);
		setHistoryOpen(false);
	};

	const handleBackToLatest = () => {
		const next = new URLSearchParams(searchParams);
		next.delete("checkpointId");
		setSearchParams(next);
	};

	const handleRestore = async () => {
		if (!threadId || !previewCheckpoint) return;

		setIsForking(true);
		try {
			const fork = await forkThreadCheckpoint(
				threadId,
				previewCheckpoint.checkpoint_id,
			);
			setHistoryOpen(false);

			if (agentId) {
				navigate(`/assistant/${agentId}/thread/${fork.thread_id}`);
			} else if (projectId) {
				navigate(`/p/${projectId}/t/${fork.thread_id}`);
			} else {
				navigate(`/thread/${fork.thread_id}`);
			}
		} catch (error: any) {
			toast.error(error.message || "Failed to restore checkpoint");
		} finally {
			setIsForking(false);
		}
	};

	return (
		<>
			<header className="bg-transparent mb-1">
				<div className="mx-auto px-4 sm:px-6 lg:px-4 pt-4">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center">{sidebarTrigger}</div>

						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								className="h-9 gap-2"
								onClick={() => setHistoryOpen(true)}
								disabled={!threadId}
							>
								<History className="h-4 w-4" />
								<span className="hidden sm:inline">History</span>
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="h-9 w-9"
								onClick={() => setSaveDialogOpen(true)}
								aria-label="Save as Assistant"
								title="Save as Assistant"
							>
								<Save className="h-4 w-4" />
							</Button>
							<ShareButton />
							<NewThreadButton />
							<div className="w-9">
								<ColorModeButton />
							</div>
						</div>
					</div>

					{threadViewMode === "checkpoint_preview" && previewCheckpoint && (
						<div className="mt-3 flex flex-col gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
							<div className="flex items-center gap-2 font-medium">
								<History className="h-4 w-4" />
								<span>Viewing checkpoint from {activePreviewLabel}</span>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									className="gap-2"
									onClick={handleBackToLatest}
								>
									<RotateCcw className="h-4 w-4" />
									<span>Back to Latest</span>
								</Button>
								<Button
									size="sm"
									className="gap-2"
									onClick={handleRestore}
									disabled={!previewCheckpoint.is_restorable || isForking}
									title={
										previewCheckpoint.is_restorable
											? "Create a new thread from this checkpoint"
											: "This checkpoint cannot be restored because it is not in a stable state"
									}
								>
									{isForking ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Sparkles className="h-4 w-4" />
									)}
									<span>Restore as New Thread</span>
								</Button>
							</div>
						</div>
					)}
				</div>
				<SaveAsAssistantDialog
					isOpen={saveDialogOpen}
					onClose={() => setSaveDialogOpen(false)}
					onSave={handleSaveAsAssistant}
				/>
			</header>

			<Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
				<SheetContent side="right" className="w-full sm:max-w-xl">
					<SheetHeader>
						<SheetTitle>Checkpoint History</SheetTitle>
					</SheetHeader>
					<div className="mt-6 flex h-[calc(100%-3rem)] flex-col gap-3 overflow-hidden">
						{checkpointsLoading && (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								<span>Loading checkpoints...</span>
							</div>
						)}

						{!checkpointsLoading && checkpointsError && (
							<p className="text-sm text-destructive">{checkpointsError}</p>
						)}

						{!checkpointsLoading &&
							!checkpointsError &&
							checkpoints.length === 0 && (
								<p className="text-sm text-muted-foreground">
									No checkpoints found for this thread.
								</p>
							)}

						<div className="flex-1 space-y-3 overflow-y-auto pr-1">
							{checkpoints.map((item: any) => {
								const isActive = item.checkpoint_id === activeCheckpointId;
								const isHead =
									item.is_head ||
									item.checkpoint_id === currentThread?.head_checkpoint_id;

								return (
									<button
										key={item.checkpoint_id}
										type="button"
										onClick={() => handleSelectCheckpoint(item.checkpoint_id)}
										className={`w-full rounded-2xl border p-4 text-left transition-colors ${
											isActive
												? "border-primary bg-primary/5"
												: "border-border hover:bg-accent/50"
										}`}
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="text-sm font-medium">
													{formatCheckpointTime(item.created_at)}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{item.source || "checkpoint"}
												</p>
											</div>
											<div className="flex flex-wrap justify-end gap-1">
												{isHead && (
													<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
														Latest
													</span>
												)}
												{item.has_files && (
													<span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
														Files
													</span>
												)}
												{item.has_todos && (
													<span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
														Todos
													</span>
												)}
												{item.has_interrupts && (
													<span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
														Interrupts
													</span>
												)}
												{!item.is_restorable && (
													<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
														Preview Only
													</span>
												)}
											</div>
										</div>
										{item.message_preview && (
											<p className="mt-3 line-clamp-2 text-sm text-foreground/85">
												{item.message_preview}
											</p>
										)}
										{item.model && (
											<p className="mt-3 text-xs text-muted-foreground">
												{item.model}
											</p>
										)}
									</button>
								);
							})}
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}
