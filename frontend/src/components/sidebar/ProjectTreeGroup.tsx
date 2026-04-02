import * as React from "react";
import { useEffect } from "react";
import {
	ChevronRight,
	FolderKanban,
	Plus,
	MoreHorizontal,
	Trash2,
	Loader2,
	MessageSquare,
	FileText,
	ChevronDown,
} from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarMenuSubButton,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSub as DropdownMenuSubMenu,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
	DropdownMenuPortal,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Project } from "@/lib/entities/project";
import { useProjectContext } from "@/context/ProjectContext";
import { useChatContext } from "@/context/ChatContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { formatContent, truncateFrom } from "@/lib/utils/format";
import { deleteThread, updateThreadProject } from "@/lib/services";
import { useAgentContext } from "@/context/AgentContext";

interface ProjectTreeGroupProps {
	projects: Project[];
	onCreateProject: () => void;
	onAddSource: (project: Project) => void;
	projectThreadsMap: Map<string, any>;
	fetchProjectThreads: (projectId: string, reset?: boolean) => Promise<void>;
	loadMoreProjectThreads: (projectId: string) => Promise<void>;
	toggleProjectExpanded: (projectId: string) => void;
	isProjectExpanded: (projectId: string) => boolean;
	addThreadToProject: (thread: any, projectId: string) => void;
	removeThreadFromProject: (threadKey: string, projectId: string) => void;
}

interface CompactThreadItemProps {
	thread: any;
	projects: Project[];
	parentProjectId: string;
	onMoveThread: (
		thread: any,
		sourceProjectId: string | null,
		targetProjectId: string | null,
	) => void;
}

function CompactThreadItem({
	thread,
	projects,
	parentProjectId,
	onMoveThread,
}: CompactThreadItemProps) {
	const { metadata, threads, setThreads, clearMessages } = useChatContext();
	const { agent } = useAgentContext();
	const { isMobile, setOpenMobile } = useSidebar();
	const navigate = useNavigate();

	const messages = thread.value?.messages || [];
	const lastMessage = messages
		.filter((msg: any) => msg.type === "human")
		.slice(-1)[0];
	const isSelected = metadata?.thread_id === thread.value?.thread_id;

	const getThreadTitle = () => {
		if (thread.value?.title) return thread.value?.title;
		if (!lastMessage) return "Empty thread";
		const content =
			typeof lastMessage.content === "string"
				? lastMessage.content
				: formatContent(lastMessage.content);
		if (!content) return "Empty thread";
		const firstLine = content.split("\n")[0];
		return truncateFrom(firstLine, "end", "...", 40);
	};

	const handleThreadClick = (event: React.MouseEvent) => {
		const threadId = thread.value?.thread_id || thread.key;
		const threadUrl = `/p/${parentProjectId}/t/${threadId}`;

		if (event.ctrlKey || event.metaKey) {
			window.open(threadUrl, "_blank", "noopener,noreferrer");
			return;
		}

		navigate(threadUrl);
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	const handleDeleteClick = async () => {
		if (window.confirm("Are you sure you want to delete this thread?")) {
			try {
				const deleted = agent?.id
					? await deleteThread(thread.key, agent.id)
					: await deleteThread(thread.key);
				if (deleted) {
					setThreads(threads.filter((t: any) => t.key !== thread.key));
					onMoveThread(thread, parentProjectId, null);
				}
				if (isSelected) {
					clearMessages();
				}
			} catch {
				alert("Failed to delete thread");
			}
		}
	};

	const handleMoveToProject = async (targetProjectId: string | null) => {
		try {
			await updateThreadProject(thread.key, targetProjectId);
			// Update local thread state in ChatContext
			const updatedThreads = threads.map((t: any) =>
				t.key === thread.key
					? { ...t, value: { ...t.value, project_id: targetProjectId } }
					: t,
			);
			setThreads(updatedThreads);
			onMoveThread(thread, parentProjectId, targetProjectId);
		} catch {
			alert("Failed to move thread");
		}
	};

	const relativeTime = thread.updated_at
		? formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })
		: "";

	return (
		<SidebarMenuSubItem className="group/thread relative">
			<SidebarMenuSubButton
				asChild
				size="sm"
				isActive={isSelected}
				className="cursor-pointer"
			>
				<button
					onClick={handleThreadClick}
					className="flex items-center gap-1.5 w-full"
				>
					<MessageSquare className="w-3 h-3 shrink-0 opacity-50" />
					<span className="truncate flex-1 text-left">{getThreadTitle()}</span>
					{relativeTime && (
						<span className="text-[10px] text-sidebar-foreground/40 shrink-0 whitespace-nowrap">
							{relativeTime}
						</span>
					)}
				</button>
			</SidebarMenuSubButton>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="absolute right-0 top-0 opacity-0 group-hover/thread:opacity-100 focus:opacity-100 transition-opacity h-5 w-5 z-10"
						onClick={(e) => e.stopPropagation()}
					>
						<MoreHorizontal className="h-3 w-3 text-sidebar-foreground/60" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuSubMenu>
						<DropdownMenuSubTrigger className="cursor-pointer">
							<FolderKanban className="mr-2 h-4 w-4" />
							Move to Project
						</DropdownMenuSubTrigger>
						<DropdownMenuPortal>
							<DropdownMenuSubContent className="w-48">
								<DropdownMenuItem
									onClick={() => handleMoveToProject(null)}
									className="cursor-pointer"
								>
									<span className="text-muted-foreground">
										Remove from project
									</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{projects.map((project) => (
									<DropdownMenuItem
										key={project.id}
										onClick={() => handleMoveToProject(project.id!)}
										className={`cursor-pointer ${
											parentProjectId === project.id ? "bg-accent" : ""
										}`}
									>
										{project.name}
										{parentProjectId === project.id && (
											<span className="ml-auto text-xs text-muted-foreground">
												Current
											</span>
										)}
									</DropdownMenuItem>
								))}
							</DropdownMenuSubContent>
						</DropdownMenuPortal>
					</DropdownMenuSubMenu>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={handleDeleteClick}
						className="text-red-300 focus:text-red-400 hover:text-red-300 cursor-pointer"
					>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</SidebarMenuSubItem>
	);
}

interface ProjectTreeItemProps {
	project: Project;
	projects: Project[];
	isExpanded: boolean;
	threadState: any;
	onToggle: () => void;
	onFetchProjectThreads: (projectId: string) => Promise<void>;
	onLoadMore: () => void;
	onAddSource: (project: Project) => void;
	onCreateThread: (projectId: string) => void;
	onMoveThread: (
		thread: any,
		sourceProjectId: string | null,
		targetProjectId: string | null,
	) => void;
}

function ProjectTreeItem({
	project,
	projects,
	isExpanded,
	threadState,
	onToggle,
	onFetchProjectThreads,
	onLoadMore,
	onAddSource,
	onCreateThread,
	onMoveThread,
}: ProjectTreeItemProps) {
	const { handleDeleteProject } = useProjectContext();
	const { setMetadata } = useChatContext();
	const projectId = project.id!;

	// Fetch threads on first expand — uses stable fetchProjectThreads reference
	useEffect(() => {
		if (isExpanded && !threadState?.loaded) {
			onFetchProjectThreads(projectId);
		}
	}, [isExpanded, threadState?.loaded, onFetchProjectThreads, projectId]);

	const handleDeleteClick = async () => {
		if (window.confirm("Are you sure you want to delete this project?")) {
			const deleted = await handleDeleteProject(project.id!);
			if (deleted) {
				setMetadata((prev: any) => {
					const { project_id: _project_id, ...rest } = prev;
					return rest;
				});
			}
		}
	};

	const threads = threadState?.threads || [];
	const isLoading = threadState?.loading || false;
	const hasMore = threadState?.hasMore || false;

	return (
		<SidebarMenuItem>
			<div className="flex items-center gap-0.5">
				<SidebarMenuButton
					onClick={onToggle}
					aria-expanded={isExpanded}
					className="flex-1 h-auto py-1.5 text-sm font-medium"
				>
					<ChevronRight
						className={`w-3.5 h-3.5 shrink-0 transition-transform ${
							isExpanded ? "rotate-90" : ""
						}`}
					/>
					<FolderKanban className="w-3.5 h-3.5 shrink-0" />
					<span className="truncate">{project.name}</span>
				</SidebarMenuButton>
				<div className="flex items-center gap-0.5 pr-1">
					<Button
						variant="ghost"
						size="icon"
						className="h-5 w-5 shrink-0"
						onClick={(e) => {
							e.stopPropagation();
							onCreateThread(project.id!);
						}}
						title={`Create new thread in ${project.name}`}
					>
						<Plus className="h-3 w-3" />
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-5 w-5 shrink-0"
								onClick={(e) => e.stopPropagation()}
							>
								<MoreHorizontal className="h-3 w-3 text-sidebar-foreground/60" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem
								onClick={() => onAddSource(project)}
								className="cursor-pointer"
							>
								<FileText className="mr-2 h-4 w-4" />
								Add Source
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={handleDeleteClick}
								className="text-red-300 focus:text-red-400 hover:text-red-300 cursor-pointer"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			{isExpanded && (
				<SidebarMenuSub>
					{isLoading && threads.length === 0 ? (
						<SidebarMenuSubItem>
							<div className="flex items-center gap-2 py-1.5 px-2 text-xs text-sidebar-foreground/50">
								<Loader2 className="h-3 w-3 animate-spin" />
								Loading...
							</div>
						</SidebarMenuSubItem>
					) : threads.length === 0 ? (
						<SidebarMenuSubItem>
							<div className="py-1.5 px-2 text-xs text-sidebar-foreground/40">
								No threads yet
							</div>
						</SidebarMenuSubItem>
					) : (
						<>
							{threads.map((thread: any) => (
								<CompactThreadItem
									key={thread.key}
									thread={thread}
									projects={projects}
									parentProjectId={project.id!}
									onMoveThread={onMoveThread}
								/>
							))}
							{hasMore && (
								<SidebarMenuSubItem>
									<button
										onClick={onLoadMore}
										disabled={isLoading}
										className="flex items-center gap-1.5 w-full py-1 px-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
									>
										{isLoading ? (
											<Loader2 className="h-3 w-3 animate-spin" />
										) : (
											<ChevronDown className="h-3 w-3" />
										)}
										Show more
									</button>
								</SidebarMenuSubItem>
							)}
						</>
					)}
				</SidebarMenuSub>
			)}
		</SidebarMenuItem>
	);
}

export function ProjectTreeGroup({
	projects,
	onCreateProject,
	onAddSource,
	projectThreadsMap,
	fetchProjectThreads,
	loadMoreProjectThreads,
	toggleProjectExpanded,
	isProjectExpanded,
	addThreadToProject,
	removeThreadFromProject,
}: ProjectTreeGroupProps) {
	const { selectProject } = useProjectContext();
	const { setMetadata } = useChatContext();
	const { isMobile, setOpenMobile } = useSidebar();
	const navigate = useNavigate();

	const handleCreateThread = (projectId: string) => {
		const project = projects.find((p) => p.id === projectId);
		if (project) {
			selectProject(project);
		}
		setMetadata((prev: any) => ({
			...prev,
			project_id: projectId,
		}));
		// Auto-expand the project so threads are visible
		if (!isProjectExpanded(projectId)) {
			toggleProjectExpanded(projectId);
		}
		navigate(`/p/${projectId}`);
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	const handleMoveThread = (
		thread: any,
		sourceProjectId: string | null,
		targetProjectId: string | null,
	) => {
		// Remove from source project's sidebar list
		if (sourceProjectId) {
			removeThreadFromProject(thread.key, sourceProjectId);
		}
		// Add to target project's sidebar list
		if (targetProjectId) {
			const movedThread = {
				...thread,
				value: { ...thread.value, project_id: targetProjectId },
			};
			addThreadToProject(movedThread, targetProjectId);
		}
	};

	return (
		<Collapsible
			key="projects"
			title={`Projects (${projects.length} items)`}
			defaultOpen={true}
			className="group/collapsible"
			data-tour="projects-section"
		>
			<SidebarGroup className="border-b border-sidebar-border">
				<SidebarGroupLabel
					asChild
					className={`
						group/label text-sidebar-foreground hover:bg-sidebar-accent
						hover:text-sidebar-accent-foreground text-sm
					`}
				>
					<div className="flex items-center w-full">
						<CollapsibleTrigger className="flex items-center flex-1">
							<FolderKanban className="w-4 h-4 mr-2" />
							Projects
							<ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
						</CollapsibleTrigger>
						<button
							onClick={(e) => {
								e.stopPropagation();
								onCreateProject();
							}}
							className="p-1 hover:bg-sidebar-accent rounded ml-1"
							title="Create project"
						>
							<Plus className="h-4 w-4" />
						</button>
					</div>
				</SidebarGroupLabel>
				<CollapsibleContent>
					<SidebarGroupContent className="px-1 pt-1">
						<SidebarMenu className="gap-0">
							{projects.length > 0 ? (
								projects.map((project) => (
									<ProjectTreeItem
										key={project.id}
										project={project}
										projects={projects}
										isExpanded={isProjectExpanded(project.id!)}
										threadState={projectThreadsMap.get(project.id!)}
										onToggle={() => toggleProjectExpanded(project.id!)}
										onFetchProjectThreads={fetchProjectThreads}
										onLoadMore={() => loadMoreProjectThreads(project.id!)}
										onAddSource={onAddSource}
										onCreateThread={handleCreateThread}
										onMoveThread={handleMoveThread}
									/>
								))
							) : (
								<div className="px-3 py-4 text-center">
									<p className="text-sm text-sidebar-foreground/50 mb-2">
										No projects yet
									</p>
									<Button
										variant="outline"
										size="sm"
										className="gap-2"
										onClick={onCreateProject}
									>
										<Plus className="h-4 w-4" />
										Create Project
									</Button>
								</div>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}
