import { type ReactNode } from "react";
import { Plus } from "lucide-react";
import { SidebarMenu } from "@/components/ui/sidebar";
import { Project } from "@/lib/entities/project";

interface ProjectsPanelProps {
	projects: Project[];
	onCreateProject: () => void;
	renderProjectItem: (project: Project) => ReactNode;
}

export function ProjectsPanel({
	projects,
	onCreateProject,
	renderProjectItem,
}: ProjectsPanelProps) {
	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
				<span className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/70">
					Projects
				</span>
				<button
					onClick={onCreateProject}
					className="p-1 hover:bg-sidebar-accent rounded text-sidebar-foreground/60 hover:text-sidebar-foreground"
					title="Create project"
				>
					<Plus className="h-3.5 w-3.5" />
				</button>
			</div>
			<div className="overflow-auto flex-1 px-1 pt-1">
				<SidebarMenu className="gap-0">
					{projects.length > 0 ? (
						projects.map((project) => (
							<div key={project.id}>{renderProjectItem(project)}</div>
						))
					) : (
						<div className="px-3 py-4 text-center text-sm text-sidebar-foreground/50">
							No projects yet
						</div>
					)}
				</SidebarMenu>
			</div>
		</div>
	);
}
