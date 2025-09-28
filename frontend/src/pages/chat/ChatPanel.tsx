import ChatInput from "@/components/inputs/ChatInput";
import ChatMessages from "@/components/lists/ChatMessages";
import AgentSection from "@/components/sections/agent-section";
import { useChatContext } from "@/context/ChatContext";
import ChatLayout from "@/layouts/ChatLayout";
import { Agent } from "@/lib/services/agentService";

interface ChatPanelProps {
	agent?: Agent;
	showAgentMenu: boolean;
}

function ChatPanel({ agent, showAgentMenu = true }: ChatPanelProps) {
	const { messages } = useChatContext();

	if (agent && messages.length === 0) {
		return (
			<ChatLayout>
				<div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
					<AgentSection />
				</div>
			</ChatLayout>
		);
	}

	// if (messages.length === 0) {
	// 	return (
	// 		<ChatLayout>
	// 			<div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
	// 				<HomeSection />
	// 			</div>
	// 		</ChatLayout>
	// 	);
	// }

	return (
		<div
			className={`
				flex h-full relative
				transition-all duration-200 ease-in-out
			`}
		>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<div className="flex-1 min-h-0">
					<ChatMessages messages={messages} />
				</div>

				<div className="sticky bottom-0 bg-background border-border">
					<div className="max-w-4xl mx-auto">
						<div className="flex flex-col gap-2 px-4 pb-4">
							<ChatInput showAgentMenu={showAgentMenu} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default ChatPanel;
