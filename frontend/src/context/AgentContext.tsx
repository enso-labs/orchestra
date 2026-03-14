import { useContext, createContext } from "react";
import useAgent from "@/hooks/useAgent";

type AgentContextType = ReturnType<typeof useAgent>;

export const AgentContext = createContext<AgentContextType | null>(null);
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

export function useAgentContext(): AgentContextType {
	const context = useContext(AgentContext);
	if (!context) {
		throw new Error("useAgentContext must be used within an AgentProvider");
	}
	return context;
}
