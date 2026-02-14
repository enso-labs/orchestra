import { useContext, createContext } from "react";
import useSkill from "@/hooks/useSkill";

export const SkillContext = createContext({});
export default function SkillProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const skillHooks = useSkill();

	return (
		<SkillContext.Provider
			value={{
				...skillHooks,
			}}
		>
			{children}
		</SkillContext.Provider>
	);
}

export function useSkillContext(): any {
	return useContext(SkillContext);
}
