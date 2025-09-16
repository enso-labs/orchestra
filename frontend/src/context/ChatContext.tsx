import { useContext, createContext } from "react";
import useConfigHook from "@/hooks/useConfigHook";
import useImageHook from "@/hooks/useImageHook";
import useChat from "@/hooks/useChat";
import useThread from "@/hooks/useThread";

export const ChatContext = createContext({});
export default function ChatProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const chatHooks = useChat();
	const imageHooks = useImageHook();
	const configHooks = useConfigHook();
	const threadHooks = useThread();

	return (
		<ChatContext.Provider
			value={{
				...chatHooks,
				...configHooks,
				...imageHooks,
				...threadHooks,
			}}
		>
			{children}
		</ChatContext.Provider>
	);
}

export function useChatContext(): any {
	return useContext(ChatContext);
}
