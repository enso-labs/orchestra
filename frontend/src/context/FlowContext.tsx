import { useContext, createContext, useState } from "react";

export const FlowContext = createContext({});

const INIT_FLOW_STATE = {
	id: null,
	data: null,
	position: null,
}

export default function FlowProvider({ children }: { children: React.ReactNode }) {
	const [node, setNode] = useState<any>(INIT_FLOW_STATE);
	
	return (    
		<FlowContext.Provider value={{
			node,
			setNode,
		}}>
				{children}
		</FlowContext.Provider>
	);
}

export function useFlowContext(): any {
    return useContext(FlowContext);
}