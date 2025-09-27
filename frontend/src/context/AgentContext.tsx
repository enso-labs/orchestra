import { useContext, createContext } from "react";
import { useAgent } from "@/hooks/useAgent";

export const AgentContext = createContext({});
export default function AgentProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const agentHooks = useAgent();

	return (
		<AgentContext.Provider
			value={{
				...agentHooks,
			}}
		>
			{children}
		</AgentContext.Provider>
	);
}

export function useAgentContext(): any {
	return useContext(AgentContext);
}
