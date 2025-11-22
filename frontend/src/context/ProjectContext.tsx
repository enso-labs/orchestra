import { useContext, createContext } from "react";
import useProject from "@/hooks/useProject";

export const ProjectContext = createContext({});

export default function ProjectProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const projectHooks = useProject();

	return (
		<ProjectContext.Provider
			value={{
				...projectHooks,
			}}
		>
			{children}
		</ProjectContext.Provider>
	);
}

export function useProjectContext(): any {
	return useContext(ProjectContext);
}
