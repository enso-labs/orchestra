import { useContext, createContext, useEffect } from "react";
import useAppHook from "@/hooks/useAppHook";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const AppContext = createContext({});

// Separate component to access context after provider is established
function DocumentTitleManager() {
	useDocumentTitle();
	return null;
}

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
			<DocumentTitleManager />
			{children}
		</AppContext.Provider>
	);
}

export function useAppContext(): any {
	return useContext(AppContext);
}
