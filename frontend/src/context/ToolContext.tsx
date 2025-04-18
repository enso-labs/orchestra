import { useContext, createContext } from "react";
import useToolHook from "@/hooks/useToolHook";
import useMcpHook from "@/hooks/useMcpHook";

export const ToolContext = createContext({});

export default function ToolProvider({ children }: { children: React.ReactNode }) {
    const toolHooks = useToolHook();
    const mcpHooks = useMcpHook();
    
    return (    
        <ToolContext.Provider value={{ ...toolHooks, ...mcpHooks }}>
            {children}
        </ToolContext.Provider>
    );
}

export function useToolContext(): any {
    return useContext(ToolContext);
}