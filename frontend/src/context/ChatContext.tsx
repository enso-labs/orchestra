import { useContext, createContext } from "react";
import useChatHook from "@/hooks/useChatHook";
import useConfigHook from "@/hooks/useConfigHook";
import useImageHook from "@/hooks/useImageHook";
import useChat from "@/hooks/useChat";
export const ChatContext = createContext({});

export default function ChatProvider({ children }: { children: React.ReactNode }) {
    const chatHooks = useChatHook();
    const imageHooks = useImageHook();
    const configHooks = useConfigHook();
    const chatV2Hooks = useChat();
    
    return (    
        <ChatContext.Provider value={{
            ...chatHooks,
            ...chatV2Hooks,
            ...configHooks,
            ...imageHooks,
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChatContext(): any {
    return useContext(ChatContext);
}