import { useContext, createContext } from "react";
import useConfigHook from "@/hooks/useConfigHook";
import useImageHook from "@/hooks/useImageHook";
import useChat from "@/hooks/useChat";
import useModel from "@/hooks/useModel";

export const ChatContext = createContext({});
export default function ChatProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const modelsHooks = useModel();
	const chatHooks = useChat();
	const imageHooks = useImageHook();
	const configHooks = useConfigHook();
	return (
		<ChatContext.Provider
			value={{
				...chatHooks,
				...configHooks,
				...imageHooks,
				...modelsHooks,
			}}
		>
			{children}
		</ChatContext.Provider>
	);
}

export function useChatContext(): any {
	return useContext(ChatContext);
}
