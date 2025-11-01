import ChatLayout from "@/layouts/chat-layout-v2";
import ChatPanel from "./ChatPanel";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import { useAppContext } from "@/context/AppContext";
import { Agent } from "@/lib/services/agentService";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ChatV2Page() {
	const { loading } = useAppContext();
	const { useEffectGetAgents } = useAgentContext();
	const {
		useEffectUpdateAssistantId,
		useListThreadsEffect,
		useListCheckpointsEffect,
		metadata,
	} = useChatContext();

	useEffectGetAgents();
	useEffectUpdateAssistantId();

	useListThreadsEffect(!loading);
	useListCheckpointsEffect(!loading, metadata);

	const defaultAgent: Agent = {
		name: "Ensō Orchestra",
		description: "Ensō is an AI assistant built by Ensō Labs.",
		model: "",
		prompt: "",
		tools: [],
		subagents: [],
	};

	return (
		<ChatLayout>
			<ChatPanel
				agent={defaultAgent}
				chatNav={
					<ChatNav sidebarTrigger={<SidebarTrigger />} />
				}
			/>
		</ChatLayout>
	);
}

export default ChatV2Page;
