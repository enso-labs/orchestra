import { useContext, createContext } from "react";
import useEpic from "@/hooks/useEpic";

type EpicContextType = ReturnType<typeof useEpic>;

export const EpicContext = createContext<EpicContextType | null>(null);

export default function EpicProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const epicHooks = useEpic();

	return (
		<EpicContext.Provider
			value={{
				...epicHooks,
			}}
		>
			{children}
		</EpicContext.Provider>
	);
}

export function useEpicContext(): EpicContextType {
	const context = useContext(EpicContext);
	if (!context) {
		throw new Error("useEpicContext must be used within an EpicProvider");
	}
	return context;
}
