import { useContext, createContext } from "react";
import useAppHook from "@/lib/hooks/useAppHook";

export const AppContext = createContext({});

export default function AppProvider({ children }: { children: React.ReactNode }) {
	const appHooks = useAppHook();
	
	return (    
		<AppContext.Provider value={{
			...appHooks,
		}}>
				{children}
		</AppContext.Provider>
	);
}

export function useAppContext(): any {
    return useContext(AppContext);
}	