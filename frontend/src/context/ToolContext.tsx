import { useContext, createContext } from "react";
import useToolHook from "@/hooks/useToolHook";

export const ToolContext = createContext({});

export default function ToolProvider({ children }: { children: React.ReactNode }) {
    const toolHooks = useToolHook();
    
    return (    
        <ToolContext.Provider value={toolHooks}>
            {children}
        </ToolContext.Provider>
    );
}

export function useToolContext(): any {
    return useContext(ToolContext);
}