import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Plus,
	ArrowLeft,
	Trash2,
	Loader2,
	ListChecks,
	User,
	AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/hooks/useTheme";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEpicContext } from "@/context/EpicContext";
import { Task } from "@/lib/entities/epic";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CreateTaskModal } from "@/components/modals/CreateTaskModal";
import { useNavigate, useParams } from "react-router-dom";
import EpicService from "@/lib/services/epicService";
import { Epic } from "@/lib/entities/epic";

const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;

function getStatusColor(status?: string) {
	switch (status) {
		case "todo":
			return "outline";
		case "in_progress":
			return "default";
		case "done":
			return "secondary";
		case "blocked":
			return "destructive";
		default:
			return "outline";
	}
}

function getStatusLabel(status?: string) {
	switch (status) {
		case "todo":
			return "To Do";
		case "in_progress":
			return "In Progress";
		case "done":
			return "Done";
		case "blocked":
			return "Blocked";
		default:
			return status || "To Do";
	}
}

function EpicDetailPage() {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const { handleUpdateTask, handleDeleteTask } = useEpicContext();
	const { theme } = useTheme();
	const [epic, setEpic] = useState<Epic | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

	useEffect(() => {
		if (!id) return;
		const fetchData = async () => {
			setLoading(true);
			try {
				const [epicRes, tasksRes] = await Promise.all([
					EpicService.get(id),
					EpicService.listTasks(id),
				]);
				setEpic(epicRes.data.epic);
				setTasks(tasksRes.data.tasks || []);
			} catch (err) {
				console.error("Failed to fetch epic details:", err);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [id]);

	const handleStatusChange = async (taskId: string, newStatus: string) => {
		if (!id) return;
		const updated = await handleUpdateTask(id, taskId, {
			status: newStatus,
		});
		if (updated) {
			setTasks((prev) =>
				prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
			);
		}
	};

	const handleDelete = async (taskId: string) => {
		if (!id) return;
		if (window.confirm("Are you sure you want to delete this task?")) {
			const success = await handleDeleteTask(id, taskId);
			if (success) {
				setTasks((prev) => prev.filter((t) => t.id !== taskId));
			}
		}
	};

	const handleTaskCreated = () => {
		// Refetch tasks after creation
		if (!id) return;
		EpicService.listTasks(id).then((res) => {
			setTasks(res.data.tasks || []);
		});
	};

	const statusSummary = () => {
		const counts: Record<string, number> = {};
		tasks.forEach((t) => {
			const s = t.status || "todo";
			counts[s] = (counts[s] || 0) + 1;
		});
		return counts;
	};

	if (loading) {
		return (
			<ChatLayout>
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ChatNav sidebarTrigger={<SidebarTrigger />} />
					<div className="flex items-center justify-center flex-1">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						<span className="ml-3 text-muted-foreground">Loading epic...</span>
					</div>
				</div>
			</ChatLayout>
		);
	}

	if (!epic) {
		return (
			<ChatLayout>
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ChatNav sidebarTrigger={<SidebarTrigger />} />
					<div className="flex flex-col items-center justify-center flex-1">
						<p className="text-muted-foreground mb-4">Epic not found</p>
						<Button variant="outline" onClick={() => navigate("/epics")}>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Epics
						</Button>
					</div>
				</div>
			</ChatLayout>
		);
	}

	const counts = statusSummary();

	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<ChatNav sidebarTrigger={<SidebarTrigger />} />
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					{/* Fixed header section */}
					<div className="flex-shrink-0 px-4 pt-4">
						<div className="mx-auto">
							<div className="mb-5">
								<Button
									variant="ghost"
									size="sm"
									className="mb-3"
									onClick={() => navigate("/epics")}
								>
									<ArrowLeft className="h-4 w-4 mr-1" />
									Back to Epics
								</Button>

								<div className="flex items-center justify-between mb-2">
									<h1 className="text-3xl font-bold text-foreground">
										{epic.name}
									</h1>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setIsCreateModalOpen(true)}
									>
										<Plus className="h-4 w-4 mr-2" />
										Add Task
									</Button>
								</div>

								{epic.description && (
									<p className="text-muted-foreground mb-4">
										{epic.description}
									</p>
								)}

								{/* Status summary */}
								<div className="flex items-center gap-3 flex-wrap">
									<span className="text-sm text-muted-foreground">
										{tasks.length} task
										{tasks.length !== 1 ? "s" : ""}
									</span>
									{Object.entries(counts).map(([status, count]) => (
										<Badge key={status} variant={getStatusColor(status)}>
											{getStatusLabel(status)}: {count}
										</Badge>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* Task list */}
					<div className="flex-1 min-h-0 px-4 pb-4">
						<div className="mx-auto h-full flex flex-col">
							<ScrollArea className="h-full">
								<div className="pb-4">
									{tasks.length > 0 ? (
										<div className="space-y-3">
											{tasks.map((task: Task) => (
												<Card key={task.id} className="group">
													<CardHeader className="pb-2">
														<div className="flex items-start justify-between">
															<div className="flex items-center gap-3 flex-1 min-w-0">
																<ListChecks className="h-4 w-4 text-muted-foreground flex-shrink-0" />
																<CardTitle className="text-sm font-medium truncate">
																	{task.title}
																</CardTitle>
															</div>
															<div className="flex items-center gap-2 flex-shrink-0">
																<Select
																	value={task.status || "todo"}
																	onValueChange={(value) =>
																		task.id &&
																		handleStatusChange(task.id, value)
																	}
																>
																	<SelectTrigger className="h-7 w-[130px] text-xs">
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent>
																		{TASK_STATUSES.map((s) => (
																			<SelectItem key={s} value={s}>
																				{getStatusLabel(s)}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
																	onClick={() =>
																		task.id && handleDelete(task.id)
																	}
																	title="Delete task"
																>
																	<Trash2 className="h-3 w-3 text-red-400" />
																</Button>
															</div>
														</div>
													</CardHeader>
													<CardContent className="pt-0">
														<div className="space-y-2">
															{task.description && (
																<div
																	style={{
																		height: Math.max(
																			60,
																			Math.min(
																				task.description.split("\n").length *
																					18 +
																					10,
																				200,
																			),
																		),
																	}}
																>
																	<Editor
																		value={task.description}
																		language="markdown"
																		height={Math.max(
																			60,
																			Math.min(
																				task.description.split("\n").length *
																					18 +
																					10,
																				200,
																			),
																		)}
																		theme={
																			theme === "light" ? "light" : "vs-dark"
																		}
																		options={{
																			readOnly: true,
																			domReadOnly: true,
																			minimap: { enabled: false },
																			lineNumbers: "off",
																			wordWrap: "on",
																			fontSize: 11,
																			scrollBeyondLastLine: false,
																			renderLineHighlight: "none",
																			contextmenu: false,
																			folding: false,
																			scrollbar: {
																				vertical: "auto",
																				horizontal: "hidden",
																				handleMouseWheel: true,
																			},
																		}}
																	/>
																</div>
															)}
															<div className="flex items-center gap-4 flex-wrap">
																<Badge variant={getStatusColor(task.status)}>
																	{getStatusLabel(task.status)}
																</Badge>
																{task.assignee && (
																	<div className="flex items-center gap-1 text-xs text-muted-foreground">
																		<User className="h-3 w-3" />
																		<span>{task.assignee}</span>
																	</div>
																)}
																{task.blockers && task.blockers.length > 0 && (
																	<div className="flex items-center gap-1 text-xs text-red-400">
																		<AlertTriangle className="h-3 w-3" />
																		<span>
																			Blocked by: {task.blockers.join(", ")}
																		</span>
																	</div>
																)}
															</div>
														</div>
													</CardContent>
												</Card>
											))}
										</div>
									) : (
										<div className="text-center py-12">
											<ListChecks className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
											<h3 className="text-lg font-semibold text-foreground mb-2">
												No tasks yet
											</h3>
											<p className="text-muted-foreground mb-4">
												Add tasks to track work within this epic
											</p>
											<Button onClick={() => setIsCreateModalOpen(true)}>
												<Plus className="h-4 w-4 mr-2" />
												Create first task
											</Button>
										</div>
									)}
								</div>
							</ScrollArea>
						</div>
					</div>
				</div>
			</div>

			<CreateTaskModal
				isOpen={isCreateModalOpen}
				onClose={() => {
					setIsCreateModalOpen(false);
					handleTaskCreated();
				}}
				epicId={id || ""}
			/>
		</ChatLayout>
	);
}

export default EpicDetailPage;
