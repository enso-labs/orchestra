import { useState } from "react";
import ChatInput from "@/components/inputs/ChatInput";
import { Project } from "@/lib/entities/project";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { EditProjectModal } from "@/components/modals/EditProjectModal";

interface ProjectSectionProps {
	project: Project;
	showAgentMenu?: boolean;
	onProjectUpdated?: (project: Project) => void;
	onUpdate?: (
		projectId: string,
		updates: Partial<Project>,
	) => Promise<Project | null>;
	loading?: boolean;
}

export function ProjectSection({
	project,
	showAgentMenu = false,
	onProjectUpdated,
	onUpdate,
	loading = false,
}: ProjectSectionProps) {
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const handleUpdate = async (
		projectId: string,
		updates: Partial<Project>,
	): Promise<Project | null> => {
		if (!onUpdate) return null;
		const result = await onUpdate(projectId, updates);
		if (result && onProjectUpdated) {
			onProjectUpdated(result);
		}
		return result;
	};

	return (
		<>
			<img
				src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
				alt="Project Logo"
				className="w-32 h-32 mx-auto rounded-full"
			/>
			<div className="flex items-center gap-2 mt-2">
				<h1 className="text-4xl font-bold">{project.name}</h1>
				{onUpdate && (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsEditModalOpen(true)}
						title="Edit project settings"
					>
						<Settings className="h-5 w-5" />
					</Button>
				)}
			</div>
			<p className="text-lg mb-2">{project.description || "No description"}</p>
			<div className="flex flex-col w-full lg:w-[600px]">
				<ChatInput showAgentMenu={showAgentMenu} />
			</div>

			{onUpdate && (
				<EditProjectModal
					isOpen={isEditModalOpen}
					onClose={() => setIsEditModalOpen(false)}
					project={project}
					onUpdate={handleUpdate}
					loading={loading}
				/>
			)}
		</>
	);
}

export default ProjectSection;
