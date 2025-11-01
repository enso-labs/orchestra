import ChatInput from "@/components/inputs/ChatInput";
import ChatMessages from "@/components/lists/ChatMessages";
import AgentSection from "@/components/sections/agent-section";
import { useChatContext } from "@/context/ChatContext";
import ChatLayout from "@/layouts/ChatLayout";
import { Agent } from "@/lib/services/agentService";

interface ChatPanelProps {
	agent?: Agent;
	chatNav?: React.ReactNode | undefined;
	sidebarTrigger?: React.ReactNode | undefined;
}

function ChatPanel({ agent, chatNav }: ChatPanelProps) {
	const { messages } = useChatContext();

	if (agent && messages.length === 0) {
		return (
			<ChatLayout>
				{chatNav}
				<div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
					<AgentSection agent={agent} />
				</div>
				<footer className="mt-auto bg-card">
					<div className="px-4 sm:px-6 lg:px-8 py-4">
						<p className="text-center text-muted-foreground text-xs">
							&copy; 2025 Ensō Labs. All rights reserved. v0.1.1
						</p>
					</div>
				</footer>
			</ChatLayout>
		);
	}

	return (
		<div
			className={`
				flex h-full relative
				transition-all duration-200 ease-in-out
			`}
		>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				{chatNav}
				<div className="flex-1 min-h-0">
					<ChatMessages messages={messages} />
				</div>

				<div className="sticky bottom-0 bg-background border-border">
					<div className="max-w-4xl mx-auto">
						<div className="flex flex-col gap-2 px-4 pb-4">
							<ChatInput />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default ChatPanel;
