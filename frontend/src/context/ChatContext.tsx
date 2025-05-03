import { useContext, createContext } from "react";
import useChatHook from "../hooks/useChatHook";

export const ChatContext = createContext({});

export default function ChatProvider({ children }: { children: React.ReactNode }) {
    const chatHooks = useChatHook();
    
    return (    
        <ChatContext.Provider value={chatHooks}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChatContext(): any {
    return useContext(ChatContext);
}