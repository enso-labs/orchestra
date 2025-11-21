import ProjectService from "@/lib/services/projectService";
import { Project, Source } from "@/lib/entities/project";
import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";

export interface ProjectState {
	projects: Project[];
	selectedProject: Project | null;
	loading: boolean;
	error: string | null;
}

export const INIT_PROJECT_STATE: ProjectState = {
	projects: [],
	selectedProject: null,
	loading: false,
	error: null,
};

export function useProject() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);
	const [projectId, setProjectId] = useQueryState("project");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Sync selectedProject with projectId from URL
	useEffect(() => {
		if (projectId && projects.length > 0) {
			const project = projects.find((p) => p.id === projectId);
			if (project && selectedProject?.id !== project.id) {
				setSelectedProject(project);
			}
		} else if (!projectId && selectedProject) {
			setSelectedProject(null);
		}
	}, [projectId, projects]);

	const handleGetProjects = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await ProjectService.search();
			setProjects(response.data.projects || []);
		} catch (err: any) {
			setError(err.message || "Failed to fetch projects");
			console.error("Failed to fetch projects:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateProject = async (
		project: Partial<Project>,
	): Promise<Project | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await ProjectService.create(project);
			const newProject = {
				...project,
				id: response.data.project_id,
			} as Project;
			setProjects((prev) => [...prev, newProject]);
			return newProject;
		} catch (err: any) {
			setError(err.message || "Failed to create project");
			console.error("Failed to create project:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteProject = async (projectId: string): Promise<boolean> => {
		setLoading(true);
		setError(null);
		try {
			await ProjectService.delete(projectId);
			setProjects((prev) => prev.filter((p) => p.id !== projectId));
			if (selectedProject?.id === projectId) {
				setSelectedProject(null);
			}
			return true;
		} catch (err: any) {
			setError(err.message || "Failed to delete project");
			console.error("Failed to delete project:", err);
			return false;
		} finally {
			setLoading(false);
		}
	};

	const handleAddSource = async (
		projectId: string,
		source: Source,
	): Promise<Source | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await ProjectService.addSource(projectId, [source]);
			const addedSources = response.data.sources || [];
			// Update the project's sources in state
			setProjects((prev) =>
				prev.map((p) => {
					if (p.id === projectId) {
						return {
							...p,
							sources: [...(p.sources || []), ...addedSources],
						};
					}
					return p;
				}),
			);
			return addedSources[0] || null;
		} catch (err: any) {
			setError(err.message || "Failed to add source");
			console.error("Failed to add source:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const selectProject = (project: Project | null) => {
		setSelectedProject(project);
		setProjectId(project?.id || null);
	};

	const useEffectGetProjects = () => {
		useEffect(() => {
			handleGetProjects();
		}, []);

		return () => {
			setProjects([]);
		};
	};

	return {
		projects,
		setProjects,
		selectedProject,
		selectProject,
		loading,
		error,
		handleGetProjects,
		handleCreateProject,
		handleDeleteProject,
		handleAddSource,
		useEffectGetProjects,
	};
}

export default useProject;
