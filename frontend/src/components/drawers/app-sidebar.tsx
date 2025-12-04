import * as React from "react";
import { useState, useRef, useCallback } from "react";
import {
	ChevronRight,
	Bot,
	// Layers,
	// Wrench,
	MessageSquare,
	MoreHorizontal,
	Trash2,
	FolderKanban,
	Plus,
	FileText,
	Loader2,
	Search,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
// import { VersionSwitcher } from "@/components/menus/version-switcher";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
	DropdownMenuPortal,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SettingsPopover } from "../popovers/SettingsPopover";
import { useChatContext } from "@/context/ChatContext";
import {
	formatContent,
	truncateFrom,
} from "@/lib/utils/format";
import { useAgentContext } from "@/context/AgentContext";
import { useProjectContext } from "@/context/ProjectContext";
import { Agent } from "@/lib/services/agentService";
import { Project } from "@/lib/entities/project";
import { CreateProjectModal } from "@/components/modals/CreateProjectModal";
import { AddSourceModal } from "@/components/modals/AddSourceModal";
import { ThreadSearchModal } from "@/components/modals/ThreadSearchModal";
import { formatDistanceToNow } from "date-fns";
import {
	deleteThread,
	updateThreadProject,
} from "@/lib/services";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useLinkClick from "@/hooks/useLinkClick";
import { AxiosResponse } from "axios";

interface AssistantItemProps {
	agent: Agent;
	url: string;
}

function AssistantItem({ agent, url }: AssistantItemProps) {
	const { agent: currentAgent } = useAgentContext();
	// const toolsCount = agent.tools?.length || 0;
	// const subagentsCount = agent.subagents?.length || 0;
	// const modelDisplay = agent.model?.split(":")[1] || agent.model || "N/A";
	const isSelected = currentAgent?.id === agent.id;

	return (
		<SidebarMenuItem className="mb-1">
			<SidebarMenuButton
				asChild
				isActive={isSelected}
				className={`h-auto px-3 py-3 rounded-lg border transition-all ${
					isSelected
						? "bg-sidebar-accent border-sidebar-accent shadow-sm"
						: "bg-transparent border-sidebar-border hover:bg-sidebar-accent/50 hover:border-sidebar-accent/50"
				}`}
			>
				<a
					href={url}
					className="flex flex-col items-start gap-1.5 w-full group"
				>
					<div className="flex items-center gap-2.5 w-full">
						<div className="flex flex-col min-w-0 flex-1">
							<span
								className={`text-sm truncate ${
									isSelected
										? "font-semibold text-sidebar-accent-foreground"
										: "font-medium text-sidebar-foreground"
								}`}
							>
								{agent.name}
							</span>
							<span className="text-xs text-sidebar-foreground/60 truncate">
								{agent.description || "No description"}
							</span>
						</div>
					</div>
					{/* <div className="flex items-center gap-2.5 text-[11px] text-sidebar-foreground/50">
						<div className="flex items-center gap-1">
							<Bot className="w-3 h-3" />
							<span>{modelDisplay}</span>
						</div>
						{toolsCount > 0 && (
							<>
								<span className="text-sidebar-foreground/30">•</span>
								<div className="flex items-center gap-1">
									<Wrench className="w-3 h-3" />
									<span>
										{toolsCount} tool{toolsCount !== 1 ? "s" : ""}
									</span>
								</div>
							</>
						)}
						{subagentsCount > 0 && (
							<>
								<span className="text-sidebar-foreground/30">•</span>
								<div className="flex items-center gap-1">
									<Layers className="w-3 h-3" />
									<span>{subagentsCount} sub</span>
								</div>
							</>
						)}
					</div> */}
				</a>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

interface ThreadItemProps {
	thread: any;
	projects: Project[];
}

function ThreadItem({ thread, projects }: ThreadItemProps) {
	const {
		metadata,
		threads,
		setThreads,
		clearMessages,
	} = useChatContext();
	const { agent } = useAgentContext();
	const { isMobile, setOpenMobile } = useSidebar();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const messages = thread.value?.messages || [];
	const fileCount = Object.keys(thread.value?.files || {}).length;
	const lastMessage = messages.filter((msg: any) => msg.type === "human").slice(-1)[0];
	const isSelected = metadata?.thread_id === thread.value?.thread_id;
	const currentProjectId = thread.value?.project_id;

	// Extract a meaningful title from the content
	const getThreadTitle = () => {
		if (!lastMessage) return "Empty thread";
		const content =
			typeof lastMessage.content === "string"
				? lastMessage.content
				: formatContent(lastMessage.content);
		// Handle case where content is undefined or empty
		if (!content) return "Empty thread";
		// Try to extract first line or sentence as title
		const firstLine = content.split("\n")[0];
		return truncateFrom(firstLine, "end", "...", 50);
	};

	const handleThreadClick = () => {
		// Navigate to thread route
		if (pathname.startsWith("/assistant/")) {
			navigate(`/assistant/${agent.id}/thread/${thread.value?.thread_id || thread.key}`);
		} else {
			navigate(`/thread/${thread.value?.thread_id || thread.key}`);
		}
		// Close sidebar on mobile
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	const handleDeleteClick = async () => {
		if (window.confirm("Are you sure you want to delete this thread?")) {
			try {
				let deleted: boolean | AxiosResponse<any, any> = false;
				if (agent.id) {
					deleted = await deleteThread(thread.key, agent.id);
				} else {
					deleted = await deleteThread(thread.key);
				}
				if (deleted) {
					setThreads(threads.filter((t: any) => t.key !== thread.key));
				}
				if (isSelected) {
					clearMessages();
				}
			} catch (error) {
				alert("Failed to delete thread");
			}
		}
	};

	const handleAddToProject = async (projectId: string | null) => {
		try {
			await updateThreadProject(thread.key, projectId);
			// Update local thread state
			const updatedThreads = threads.map((t: any) =>
				t.key === thread.key
					? { ...t, value: { ...t.value, project_id: projectId } }
					: t,
			);
			setThreads(updatedThreads);
		} catch (error) {
			alert("Failed to add thread to project");
		}
	};

	const threadTitle = getThreadTitle();

	// Get the model from the last message
	const model =
		lastMessage?.model?.split(":")[1] || lastMessage?.model || "N/A";

	// Format relative time using date-fns
	const relativeTime = thread.updated_at
		? formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })
		: "";

	return (
		<SidebarMenuItem className="mb-1 group/thread relative">
			<SidebarMenuButton
				asChild
				isActive={isSelected}
				className={`h-auto px-3 py-3 rounded-lg border transition-all ${
					isSelected
						? "bg-sidebar-accent border-sidebar-accent shadow-sm"
						: "bg-transparent border-sidebar-border hover:bg-sidebar-accent/50 hover:border-sidebar-accent/50"
				}`}
			>
				<button
					onClick={handleThreadClick}
					className="flex items-start gap-2.5 w-full"
				>
					<div className="flex flex-col min-w-0 flex-1 gap-1.5">
						<div className="flex items-start justify-between gap-2 w-full">
							<span
								className={`text-sm leading-tight line-clamp-2 ${
									isSelected
										? "font-semibold text-sidebar-accent-foreground"
										: "font-medium text-sidebar-foreground"
								}`}
							>
								{threadTitle}
							</span>
							{relativeTime && (
								<span className="text-[10px] text-sidebar-foreground/40 shrink-0 font-normal mt-0.5 whitespace-nowrap">
									{relativeTime}
								</span>
							)}
						</div>
						<div className="flex items-center gap-2.5 text-[11px] text-sidebar-foreground/50">
							<div className="flex items-center gap-1">
								<span className="font-medium">{fileCount}</span>
								<span>file{fileCount !== 1 ? "s" : ""}</span>
							</div>
							<span className="text-sidebar-foreground/30">•</span>
							<div className="flex items-center gap-1 truncate">
								<span className="truncate">{model}</span>
							</div>
						</div>
					</div>
				</button>
			</SidebarMenuButton>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="absolute right-2 bottom-2 opacity-0 group-hover/thread:opacity-100 transition-opacity h-6 w-6"
						onClick={(e) => e.stopPropagation()}
					>
						<MoreHorizontal className="h-3.5 w-3.5 text-sidebar-foreground/60" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuSub>
						<DropdownMenuSubTrigger className="cursor-pointer">
							<FolderKanban className="mr-2 h-4 w-4" />
							{currentProjectId ? "Move to Project" : "Add to Project"}
						</DropdownMenuSubTrigger>
						<DropdownMenuPortal>
							<DropdownMenuSubContent className="w-48">
								{currentProjectId && (
									<>
										<DropdownMenuItem
											onClick={() => handleAddToProject(null)}
											className="cursor-pointer"
										>
											<span className="text-muted-foreground">
												Remove from project
											</span>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
									</>
								)}
								{projects.length > 0 ? (
									projects.map((project) => (
										<DropdownMenuItem
											key={project.id}
											onClick={() => handleAddToProject(project.id!)}
											className={`cursor-pointer ${
												currentProjectId === project.id
													? "bg-accent"
													: ""
											}`}
										>
											{project.name}
											{currentProjectId === project.id && (
												<span className="ml-auto text-xs text-muted-foreground">
													Current
												</span>
											)}
										</DropdownMenuItem>
									))
								) : (
									<DropdownMenuItem disabled>
										No projects available
									</DropdownMenuItem>
								)}
							</DropdownMenuSubContent>
						</DropdownMenuPortal>
					</DropdownMenuSub>
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
		</SidebarMenuItem>
	);
}

interface ProjectItemProps {
	project: Project;
	onAddSource: (project: Project) => void;
}

function ProjectItem({ project, onAddSource }: ProjectItemProps) {
	const { selectedProject, selectProject, handleDeleteProject } =
		useProjectContext();
	const { setMetadata } = useChatContext();
	const { isMobile, setOpenMobile } = useSidebar();
	const navigate = useNavigate();

	const isSelected = selectedProject?.id === project.id;
	const sourceCount = project.sources?.length || 0;

	const handleProjectClick = () => {
		selectProject(project);
		setMetadata((prev: any) => ({
			...prev,
			project_id: project.id,
		}));
		if (isMobile) {
			setOpenMobile(false);
		}
		// Navigate to project page
		navigate(`/p/${project.id}`);
	};

	const handleDeleteClick = async () => {
		if (window.confirm("Are you sure you want to delete this project?")) {
			const deleted = await handleDeleteProject(project.id!);
			if (deleted) {
				setMetadata((prev: any) => {
					const { project_id, ...rest } = prev;
					return rest;
				});
			}
		}
	};

	const relativeTime = project.updated_at
		? formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })
		: "";

	return (
		<SidebarMenuItem className="mb-1 group/project relative">
			<SidebarMenuButton
				asChild
				isActive={isSelected}
				className={`h-auto px-3 py-3 rounded-lg border transition-all ${
					isSelected
						? "bg-sidebar-accent border-sidebar-accent shadow-sm"
						: "bg-transparent border-sidebar-border hover:bg-sidebar-accent/50 hover:border-sidebar-accent/50"
				}`}
			>
				<button
					onClick={handleProjectClick}
					className="flex items-start gap-2.5 w-full"
				>
					<div className="flex flex-col min-w-0 flex-1 gap-1.5">
						<div className="flex items-start justify-between gap-2 w-full">
							<span
								className={`text-sm leading-tight line-clamp-2 ${
									isSelected
										? "font-semibold text-sidebar-accent-foreground"
										: "font-medium text-sidebar-foreground"
								}`}
							>
								{project.name}
							</span>
							{relativeTime && (
								<span className="text-[10px] text-sidebar-foreground/40 shrink-0 font-normal mt-0.5 whitespace-nowrap">
									{relativeTime}
								</span>
							)}
						</div>
						{project.description && (
							<span className="text-xs text-sidebar-foreground/60 truncate">
								{project.description}
							</span>
						)}
						<div className="flex items-center gap-2.5 text-[11px] text-sidebar-foreground/50">
							<div className="flex items-center gap-1">
								<FileText className="w-3 h-3" />
								<span>
									{sourceCount} source{sourceCount !== 1 ? "s" : ""}
								</span>
							</div>
						</div>
					</div>
				</button>
			</SidebarMenuButton>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="absolute right-2 bottom-2 opacity-0 group-hover/project:opacity-100 transition-opacity h-6 w-6"
						onClick={(e) => e.stopPropagation()}
					>
						<MoreHorizontal className="h-3.5 w-3.5 text-sidebar-foreground/60" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuItem
						onClick={() => onAddSource(project)}
						className="cursor-pointer"
					>
						<Plus className="mr-2 h-4 w-4" />
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
		</SidebarMenuItem>
	);
}

interface ProjectsCollapsibleGroupProps {
	projects: Project[];
	onCreateProject: () => void;
	onAddSource: (project: Project) => void;
}

function ProjectsCollapsibleGroup({
	projects,
	onCreateProject,
	onAddSource,
}: ProjectsCollapsibleGroupProps) {
	return (
		<Collapsible
			key="projects"
			title={`Projects (${projects.length} items)`}
			defaultOpen={false}
			className="group/collapsible"
		>
			<SidebarGroup className="border-b border-sidebar-border">
				<SidebarGroupLabel
					asChild
					className={`
						group/label text-sidebar-foreground hover:bg-sidebar-accent
						hover:text-sidebar-accent-foreground text-sm
					`}
				>
					<CollapsibleTrigger>
						<FolderKanban className="w-4 h-4 mr-2" />
						Projects
						<ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
					</CollapsibleTrigger>
				</SidebarGroupLabel>
				<CollapsibleContent>
					<SidebarGroupContent className="px-1 pt-2">
						<div className="px-2 pb-2">
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start gap-2"
								onClick={onCreateProject}
							>
								<Plus className="h-4 w-4" />
								Create Project
							</Button>
						</div>
						<SidebarMenu className="gap-0">
							{projects.length > 0 ? (
								projects.map((project) => (
									<ProjectItem
										key={project.id}
										project={project}
										onAddSource={onAddSource}
									/>
								))
							) : (
								<div className="px-3 py-4 text-center text-sm text-sidebar-foreground/50">
									No projects yet
								</div>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}

interface CollapsibleGroupProps {
	title: string;
	items: any[];
	type: "assistants" | "threads";
	projects?: Project[];
	loadMore?: (filter?: any) => Promise<void>;
	hasMore?: boolean;
	isLoadingMore?: boolean;
	onSearchClick?: () => void;
}

function CollapsibleGroup({
	title,
	items,
	type,
	projects = [],
	loadMore,
	hasMore = false,
	isLoadingMore = false,
	onSearchClick,
}: CollapsibleGroupProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const titleIcon =
		type === "assistants" ? (
			<Bot className="w-4 h-4 mr-2" />
		) : (
			<MessageSquare className="w-4 h-4 mr-2" />
		);

	// Virtualization setup (only for threads)
	const getScrollElement = useCallback(() => scrollRef.current, []);
	const estimateSize = useCallback(() => 100, []);

	const virtualizer = type === "threads" ? useVirtualizer({
		count: items.length,
		getScrollElement,
		estimateSize,
		overscan: 5,
	}) : null;

	// Infinite scroll detection (only for threads)
	const isNearBottom = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return false;
		return el.scrollHeight - el.scrollTop - el.clientHeight < 200;
	}, []);

	const handleScroll = useCallback(() => {
		if (type === "threads" && isNearBottom() && hasMore && !isLoadingMore && loadMore) {
			// Filter for unassociated threads (no project_id)
			loadMore({});
		}
	}, [type, isNearBottom, hasMore, isLoadingMore, loadMore]);

	return (
		<Collapsible
			key={title}
			title={`${title} (${items.length} items)`}
			defaultOpen={type === "threads"}
			className="group/collapsible"
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
							{titleIcon}
							{title}
							<ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
						</CollapsibleTrigger>
						{type === "threads" && onSearchClick && (
							<button
								onClick={(e) => {
									e.stopPropagation();
									onSearchClick();
								}}
								className="p-1 hover:bg-sidebar-accent rounded ml-1"
								title="Search threads"
							>
								<Search className="h-4 w-4" />
							</button>
						)}
					</div>
				</SidebarGroupLabel>
				<CollapsibleContent>
					<SidebarGroupContent className="px-1 pt-2">
						{type === "threads" && virtualizer ? (
							<div
								ref={scrollRef}
								onScroll={handleScroll}
								className="overflow-auto max-h-[calc(100vh-400px)]"
							>
								<SidebarMenu className="gap-0" style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
									{virtualizer.getVirtualItems().map((virtualRow) => {
										const item = items[virtualRow.index];
										return (
											<div
												key={item.key}
												data-index={virtualRow.index}
												ref={virtualizer.measureElement}
												className="absolute top-0 left-0 w-full"
												style={{ transform: `translateY(${virtualRow.start}px)` }}
											>
												<ThreadItem
													thread={item}
													projects={projects}
												/>
											</div>
										);
									})}
								</SidebarMenu>
								{isLoadingMore && (
									<div className="flex items-center justify-center gap-2 p-3 text-sm text-sidebar-foreground/60">
										<Loader2 className="h-4 w-4 animate-spin" />
										<span>Loading more threads...</span>
									</div>
								)}
								{items.length === 0 && !isLoadingMore && (
									<div className="px-3 py-4 text-center text-sm text-sidebar-foreground/50">
										No threads yet
									</div>
								)}
							</div>
						) : (
							<SidebarMenu className="gap-0">
								{type === "assistants"
									? items.map((item) => (
											<AssistantItem
												key={item.agent.id || item.agent.name}
												agent={item.agent}
												url={item.url}
											/>
										))
									: items.map((item) => (
											<ThreadItem
												key={item.key}
												thread={item}
												projects={projects}
											/>
										))}
							</SidebarMenu>
						)}
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}

// const versions = ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { threads, loadMoreThreads, hasMoreThreads, isLoadingMoreThreads } = useChatContext();
	const { projects, useEffectGetProjects } = useProjectContext();

	// Modal state
	const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
		useState(false);
	const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
	const [selectedProjectForSource, setSelectedProjectForSource] =
		useState<Project | null>(null);
	const [isThreadSearchOpen, setIsThreadSearchOpen] = useState(false);

	// Fetch projects on mount
	useEffectGetProjects();

	// Filter out threads that are associated with a project
	const unassociatedThreads = threads.filter(
		(thread: any) => !thread.value?.project_id,
	);

	const handleAddSource = (project: Project) => {
		setSelectedProjectForSource(project);
		setIsAddSourceModalOpen(true);
	};

	return (
		<>
			<Sidebar {...props} autoFocus={false}>
				<SidebarHeader>
					{/* <VersionSwitcher versions={versions} defaultVersion={versions[0]} /> */}
					<Link
						to="/"
						onClick={useLinkClick("/")}
						className="flex items-center gap-2 m-2"
					>
						<img
							src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
							alt="Logo"
							className="w-8 h-8 rounded-full"
						/>
						<h1 className="text-2xl font-bold text-foreground">Ensō</h1>
					</Link>
					{/* <SearchForm /> */}
				</SidebarHeader>
				<SidebarContent className="gap-0">
					{/* Assistants Link */}
					<SidebarGroup className="border-b border-sidebar-border">
						<SidebarGroupLabel
							asChild
							className={`
								group/label text-sidebar-foreground hover:bg-sidebar-accent
								hover:text-sidebar-accent-foreground text-sm
							`}
						>
							<Link to="/assistants" className="flex items-center w-full">
								<Bot className="w-4 h-4 mr-2" />
								Assistants
							</Link>
						</SidebarGroupLabel>
					</SidebarGroup>

					<ProjectsCollapsibleGroup
						projects={projects}
						onCreateProject={() => setIsCreateProjectModalOpen(true)}
						onAddSource={handleAddSource}
					/>
					<CollapsibleGroup
						title="Threads"
						items={unassociatedThreads}
						type="threads"
						projects={projects}
						loadMore={loadMoreThreads}
						hasMore={hasMoreThreads}
						isLoadingMore={isLoadingMoreThreads}
						onSearchClick={() => setIsThreadSearchOpen(true)}
					/>
				</SidebarContent>
				<SidebarFooter>
					<SettingsPopover />
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>

			<CreateProjectModal
				isOpen={isCreateProjectModalOpen}
				onClose={() => setIsCreateProjectModalOpen(false)}
			/>

			<AddSourceModal
				isOpen={isAddSourceModalOpen}
				onClose={() => {
					setIsAddSourceModalOpen(false);
					setSelectedProjectForSource(null);
				}}
				project={selectedProjectForSource}
			/>

			<ThreadSearchModal
				isOpen={isThreadSearchOpen}
				onClose={() => setIsThreadSearchOpen(false)}
			/>
		</>
	);
}
