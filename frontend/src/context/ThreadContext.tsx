import { useContext, createContext } from "react";
import useThread from "@/hooks/useThread";

export const ThreadContext = createContext({});
export default function ThreadProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const threadHooks = useThread();

	return (
		<ThreadContext.Provider
			value={{
				...threadHooks,
			}}
		>
			{children}
		</ThreadContext.Provider>
	);
}

export function useThreadContext(): any {
	return useContext(ThreadContext);
}
