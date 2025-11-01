import ChatLayout from "@/layouts/chat-layout-v2";
import ChatPanel from "./ChatPanel";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import { useAppContext } from "@/context/AppContext";

export function Chatv2() {
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
	return (
		<ChatLayout>
			<ChatPanel showAgentMenu={false} />
		</ChatLayout>
	)
}

export default Chatv2;