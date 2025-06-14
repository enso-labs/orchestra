import { useContext, createContext } from "react";
import useToolHook from "@/lib/hooks/useToolHook";
import useMcpHook from "@/lib/hooks/useMcpHook";
import useA2AHook from "@/lib/hooks/useA2AHook";
import useServerHook from "@/lib/hooks/useServerHook";
export const ToolContext = createContext({});

export default function ToolProvider({ children }: { children: React.ReactNode }) {
	const mcpHooks = useMcpHook();
	const toolHooks = useToolHook();
	const a2aHooks = useA2AHook();
	const serverHooks = useServerHook();
	
	return (    
		<ToolContext.Provider 
			value={{ 
				...toolHooks, 
				...mcpHooks, 
				...a2aHooks,
				...serverHooks,
			}}
		>
			{children}
		</ToolContext.Provider>
	);
}

export function useToolContext(): any {
    return useContext(ToolContext);
}