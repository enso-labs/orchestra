import { type ReactNode } from "react";
import type { PanelId } from "./ActivityBar";
import { ThreadsPanel } from "./panels/ThreadsPanel";
import { ProjectsPanel } from "./panels/ProjectsPanel";
import { SchedulesPanel } from "./panels/SchedulesPanel";
import { Project } from "@/lib/entities/project";

interface SidePanelProps {
	activePanel: PanelId | null;
	// Threads props
	threads: any[];
	projects: Project[];
	loadMoreThreads?: (filter?: any) => Promise<void>;
	hasMoreThreads?: boolean;
	isLoadingMoreThreads?: boolean;
	onSearchClick?: () => void;
	renderThreadItem: (thread: any, projects: Project[]) => ReactNode;
	// Projects props
	onCreateProject: () => void;
	renderProjectItem: (project: Project) => ReactNode;
}

export function SidePanel({
	activePanel,
	threads,
	projects,
	loadMoreThreads,
	hasMoreThreads,
	isLoadingMoreThreads,
	onSearchClick,
	renderThreadItem,
	onCreateProject,
	renderProjectItem,
}: SidePanelProps) {
	if (!activePanel) {
		return null;
	}

	// Route-only panels (assistants, memories) navigate to full pages — no sidebar content
	if (activePanel === "assistants" || activePanel === "memories") {
		return null;
	}

	return (
		<div className="flex-1 min-w-0 h-full overflow-hidden">
			{activePanel === "threads" && (
				<ThreadsPanel
					threads={threads}
					projects={projects}
					loadMore={loadMoreThreads}
					hasMore={hasMoreThreads}
					isLoadingMore={isLoadingMoreThreads}
					onSearchClick={onSearchClick}
					renderThreadItem={renderThreadItem}
				/>
			)}
			{activePanel === "projects" && (
				<ProjectsPanel
					projects={projects}
					onCreateProject={onCreateProject}
					renderProjectItem={renderProjectItem}
				/>
			)}
			{activePanel === "schedules" && <SchedulesPanel />}
		</div>
	);
}
