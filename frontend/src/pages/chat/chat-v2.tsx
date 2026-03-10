import ChatLayout from "@/layouts/chat-layout-v2";
import ChatPanel from "./ChatPanel";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import { useAppContext } from "@/context/AppContext";
import { Agent } from "@/lib/services/agentService";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import useInitialThreadRedirect from "@/hooks/useInitialThreadRedirect";

export function ChatV2Page() {
	const { loading } = useAppContext();
	const { useEffectGetAgents } = useAgentContext();
	const {
		useEffectUpdateAssistantId,
		useListThreadsEffect,
		useListCheckpointsEffect,
		metadata,
		messages,
		useModelsEffect,
	} = useChatContext();

	useModelsEffect();
	useEffectGetAgents();
	useEffectUpdateAssistantId();

	useListThreadsEffect(!loading);
	useListCheckpointsEffect(!loading, metadata);
	useInitialThreadRedirect({
		threadId: metadata?.thread_id,
		hasMessages: messages.length > 0,
	});

	const defaultAgent: Agent = {
		name: "ORCHESTRA",
		description: "Steerable Harnesses built on DeepAgents",
		model: "",
		prompt: "",
		tools: [],
		subagents: [],
	};

	return (
		<ChatLayout>
			<ChatPanel
				agent={defaultAgent}
				chatNav={<ChatNav sidebarTrigger={<SidebarTrigger />} />}
				showSandboxStatus={true}
			/>
		</ChatLayout>
	);
}

export default ChatV2Page;
