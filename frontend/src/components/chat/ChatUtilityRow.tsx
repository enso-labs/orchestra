import ThreadSandboxStatus from "@/components/status/ThreadSandboxStatus";
import type { Todo } from "@/components/lists/TodoList";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useChatContext } from "@/context/ChatContext";
import { cn } from "@/lib/utils";
import {
	CheckCircle2,
	Circle,
	FolderCode,
	ListTodo,
	Loader2,
} from "lucide-react";

export default function ChatUtilityRow() {
	const { viewMode, setViewMode, fileSystem, todos } = useChatContext();
	const fileCount = fileSystem?.size || 0;
	const completedCount =
		todos?.filter((todo: Todo) => todo.status === "completed").length ?? 0;
	const inProgressTodo = todos?.find(
		(todo: Todo) => todo.status === "in_progress",
	);

	return (
		<div className="flex items-center justify-between">
			<ThreadSandboxStatus />
			<div className="flex items-center gap-2">
				{todos && todos.length > 0 && (
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 rounded-full border border-border/60 px-3 text-xs text-muted-foreground hover:text-foreground"
							>
								{inProgressTodo ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<ListTodo className="h-3.5 w-3.5" />
								)}
								<span>Tasks</span>
								<span className="text-foreground">
									{completedCount}/{todos.length}
								</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent side="top" align="end" className="w-80 p-2">
							<div className="px-2 pb-2">
								<p className="text-sm font-medium">Tasks</p>
								<p className="text-xs text-muted-foreground">
									{completedCount} of {todos.length} completed
								</p>
							</div>
							<div className="space-y-1">
								{todos.map((todo: Todo, index: number) => {
									const isCompleted = todo.status === "completed";
									const isInProgress = todo.status === "in_progress";

									return (
										<div
											key={`${todo.content}-${index}`}
											className={cn(
												"flex items-start gap-3 rounded-lg px-3 py-2 text-left",
												isInProgress && "bg-accent",
											)}
										>
											{isCompleted ? (
												<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
											) : isInProgress ? (
												<Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-500" />
											) : (
												<Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
											)}
											<span className="min-w-0">
												<span
													className={cn(
														"block text-sm",
														isCompleted && "text-muted-foreground line-through",
														isInProgress && "font-medium text-foreground",
													)}
												>
													{todo.content}
												</span>
												{isInProgress && todo.activeForm && (
													<span className="block truncate text-xs text-blue-500">
														{todo.activeForm}
													</span>
												)}
											</span>
										</div>
									);
								})}
							</div>
						</PopoverContent>
					</Popover>
				)}
				<Button
					data-tour="files-toggle-button"
					variant="ghost"
					size="sm"
					className="h-8 rounded-full border border-border/60 px-3 text-xs text-muted-foreground hover:text-foreground"
					onClick={() => setViewMode(viewMode === "chat" ? "editor" : "chat")}
					title={viewMode === "editor" ? "Back to Chat" : "Manage Files"}
				>
					<FolderCode className="h-3.5 w-3.5" />
					<span>Files</span>
					{fileCount > 0 && (
						<span className="text-foreground">{fileCount}</span>
					)}
				</Button>
			</div>
		</div>
	);
}
