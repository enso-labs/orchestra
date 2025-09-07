import { useContext, createContext } from "react";
import useChatHook from "@/hooks/useChatHook";
import useConfigHook from "@/hooks/useConfigHook";
import useImageHook from "@/hooks/useImageHook";
import useChat from "@/hooks/useChat";
import useThread from "@/hooks/useThread";
export const ChatContext = createContext({});

export default function ChatProvider({ children }: { children: React.ReactNode }) {
    const chatHooks = useChatHook();
    const imageHooks = useImageHook();
    const configHooks = useConfigHook();
    const chatV2Hooks = useChat();
    const threadHooks = useThread();
    
    return (    
        <ChatContext.Provider value={{
            ...chatHooks,
            ...chatV2Hooks,
            ...configHooks,
            ...imageHooks,
            ...threadHooks,
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChatContext(): any {
    return useContext(ChatContext);
}