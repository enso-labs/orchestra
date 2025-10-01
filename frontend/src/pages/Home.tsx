import NoAuthLayout from "../layouts/NoAuthLayout";
import { useChatContext } from "@/context/ChatContext";
import HomeSection from "@/components/sections/home";
import ChatPanel from "./chat/ChatPanel";
import LLLMConfig from "@/lib/config/llm";
import { useEffect } from "react";
import { useAgentContext } from "@/context/AgentContext";
import { Agent } from "@/lib/services/agentService";
import { ChatNav } from "@/components/nav/ChatNav";

export default function Home() {
	const { messages } = useChatContext();
	const { setAgent } = useAgentContext();

	useEffect(() => {
		setAgent((prev: Agent) => ({
			...prev,
			model: LLLMConfig.DEFAULT_CHAT_MODEL,
		}));
	}, []);

	if (messages.length === 0) {
		return (
			<NoAuthLayout>
				<HomeSection />
			</NoAuthLayout>
		);
	}

	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			<div
				className={`
          flex h-full relative
          transition-all duration-200 ease-in-out
      `}
			>
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ChatPanel
						showAgentMenu={false}
						chatNav={<ChatNav onMenuClick={() => {}} />}
					/>
				</div>
			</div>
		</div>
	);
}
