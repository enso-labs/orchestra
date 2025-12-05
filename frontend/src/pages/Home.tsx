import NoAuthLayout from "../layouts/NoAuthLayout";
import { useChatContext } from "@/context/ChatContext";
import HomeSection from "@/components/sections/home";
import ChatPanel from "./chat/ChatPanel";
import LLLMConfig from "@/lib/config/llm";
import { useEffect } from "react";
import { useAgentContext } from "@/context/AgentContext";
import { Agent } from "@/lib/services/agentService";
import { ChatNav } from "@/components/nav/ChatNav";
import { getAuthToken } from "@/lib/utils/auth";
import ChatLayout from "@/layouts/chat-layout-v2";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Home() {
	const { messages, useModelsEffect } = useChatContext();
	useModelsEffect();
	const { setAgent } = useAgentContext();
	const isAuthenticated = Boolean(getAuthToken());

	useEffect(() => {
		setAgent((prev: Agent) => ({
			...prev,
			model: LLLMConfig.DEFAULT_CHAT_MODEL,
		}));
	}, []);

	// Show NoAuthLayout only when not authenticated
	if (!isAuthenticated) {
		return (
			<NoAuthLayout showModelSelector>
				<HomeSection />
			</NoAuthLayout>
		);
	}

	// When authenticated, show ChatNav with model selector
	if (messages.length === 0) {
		return (
			<ChatLayout>
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ChatNav sidebarTrigger={<SidebarTrigger />} />
					<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
						<HomeSection />
					</div>
				</div>
			</ChatLayout>
		);
	}

	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			<ChatPanel chatNav={<ChatNav />} />
		</div>
	);
}
