import ChatInput from "@/components/inputs/ChatInput";
import { Project } from "@/lib/entities/project";

interface ProjectSectionProps {
	project: Project;
	showAgentMenu?: boolean;
}

export function ProjectSection({
	project,
	showAgentMenu = false,
}: ProjectSectionProps) {
	return (
		<>
			<img
				src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
				alt="Project Logo"
				className="w-32 h-32 mx-auto rounded-full"
			/>
			<h1 className="text-4xl font-bold mt-2">{project.name}</h1>
			<p className="text-lg mb-2">{project.description || "No description"}</p>
			<div className="flex flex-col w-full lg:w-[600px]">
				<ChatInput showAgentMenu={showAgentMenu} />
			</div>
		</>
	);
}

export default ProjectSection;
