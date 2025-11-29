import { useContext, createContext, useEffect } from "react";
import useAppHook from "@/hooks/useAppHook";

export const AppContext = createContext({});

export default function AppProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const appHooks = useAppHook();

	useEffect(() => {
		appHooks.fetchAppVersion();
	}, []);

	return (
		<AppContext.Provider
			value={{
				...appHooks,
			}}
		>
			{children}
		</AppContext.Provider>
	);
}

export function useAppContext(): any {
	return useContext(AppContext);
}
