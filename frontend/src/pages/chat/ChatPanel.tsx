import ChatInput from "@/components/inputs/ChatInput";
import ChatMessages from "@/components/lists/ChatMessages";
import AgentSection from "@/components/sections/agent-section";
import { useChatContext } from "@/context/ChatContext";
import ChatLayout from "@/layouts/ChatLayout";
import { Agent } from "@/lib/services/agentService";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import FileEditorPanel from "@/components/panels/FileEditorPanel";

interface ChatPanelProps {
	agent?: Agent;
	chatNav?: React.ReactNode | undefined;
	sidebarTrigger?: React.ReactNode | undefined;
	showAgentMenu?: boolean;
}

function ChatPanel({ agent, chatNav, showAgentMenu = true }: ChatPanelProps) {
	const { messages, viewMode, filesMap } = useChatContext();

	if (agent && messages.length === 0) {
		return (
			<ChatLayout>
				{chatNav}
				<div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
					<AgentSection agent={agent} showAgentMenu={showAgentMenu} />
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
		<div className="flex h-full relative">
			{viewMode === "chat" ? (
				// CHAT MODE (Default) - Full-width chat
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
			) : (
				// EDITOR MODE - Split view (files left, chat right)
				<ResizablePanelGroup direction="horizontal" className="flex-1">
					{/* LEFT: File Editor Panel */}
					<ResizablePanel
						defaultSize={60}
						minSize={50}
						maxSize={80}
						className="hidden md:block"
					>
						<FileEditorPanel filesMap={filesMap} />
					</ResizablePanel>

					<ResizableHandle withHandle className="hidden md:flex" />

					{/* RIGHT: Chat Panel */}
					<ResizablePanel defaultSize={40} minSize={20} maxSize={50}>
						<div className="flex flex-col h-full min-h-0 overflow-hidden">
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
					</ResizablePanel>
				</ResizablePanelGroup>
			)}
		</div>
	);
}

export default ChatPanel;
