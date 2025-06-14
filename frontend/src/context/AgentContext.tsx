import { useContext, createContext } from "react";
import useAgentHook from "@/lib/hooks/useAgentHook";

export const AgentContext = createContext({});

export default function AgentProvider({ children }: { children: React.ReactNode }) {
    const agentHooks = useAgentHook();
    
    return (    
        <AgentContext.Provider value={agentHooks}>
            {children}
        </AgentContext.Provider>
    );
}

export function useAgentContext(): any {
    return useContext(AgentContext);
}