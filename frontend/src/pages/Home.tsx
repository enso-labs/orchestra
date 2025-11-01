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
			<ChatPanel chatNav={<ChatNav />} />
		</div>
	);
}
