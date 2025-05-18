import { useContext, createContext } from "react";
import useChatHook from "../hooks/useChatHook";
import useConfigHook from "@/hooks/useConfigHook";
import useImageHook from "@/hooks/useImageHook";
export const ChatContext = createContext({});

export default function ChatProvider({ children }: { children: React.ReactNode }) {
    const chatHooks = useChatHook();
    const imageHooks = useImageHook();
    const configHooks = useConfigHook();
    
    return (    
        <ChatContext.Provider value={{...chatHooks, ...configHooks, ...imageHooks}}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChatContext(): any {
    return useContext(ChatContext);
}