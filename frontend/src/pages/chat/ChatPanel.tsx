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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import FileEditorPanel from "@/components/panels/FileEditorPanel";
import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface ChatPanelProps {
	agent?: Agent;
	chatNav?: React.ReactNode | undefined;
	sidebarTrigger?: React.ReactNode | undefined;
	showAgentMenu?: boolean;
}

function ChatPanel({ agent, chatNav, showAgentMenu = true }: ChatPanelProps) {
	const { appVersion } = useAppContext();
	const { messages, viewMode, setViewMode, filesMap } = useChatContext();
	const isMobile = useMediaQuery("(max-width: 768px)");

	// Check if there are any files in the filesMap
	const hasFiles = filesMap.size > 0;

	// Show AgentSection only when in chat mode with no messages and no files
	if (agent && messages.length === 0 && viewMode === "chat" && !hasFiles) {
		return (
			<ChatLayout>
				{chatNav}
				<div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
					<AgentSection agent={agent} showAgentMenu={showAgentMenu} />
				</div>
				<footer className="mt-auto bg-card">
					<div className="px-4 sm:px-6 lg:px-8 py-4">
						<p className="text-center text-muted-foreground text-xs">
							&copy; 2025 Ensō Labs. All rights reserved. v{appVersion}
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
				<>
					{/* Desktop: ResizablePanel split view (unchanged behavior) */}
					<ResizablePanelGroup
						direction="horizontal"
						className="hidden md:flex flex-1"
					>
						{/* LEFT: File Editor Panel */}
						<ResizablePanel defaultSize={60} minSize={50} maxSize={80}>
							<FileEditorPanel filesMap={filesMap} />
						</ResizablePanel>

						<ResizableHandle withHandle />

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

					{/* Mobile: Sheet overlay with editor */}
					<div className="md:hidden flex-1 flex flex-col">
						{/* Background: Chat view */}
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

						{/* Foreground: Editor Sheet - Only on mobile */}
						{isMobile && (
							<Sheet open={true} onOpenChange={() => setViewMode("chat")}>
								<SheetContent
									side="right"
									className="w-full h-full p-0 max-w-none flex flex-col [&>button]:hidden"
									aria-label="File editor"
								>
									{/* Mobile header with Back button */}
									<div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setViewMode("chat")}
											className="gap-2"
											aria-label="Back to chat"
										>
											<ArrowLeft className="h-4 w-4" />
											<span>Back to Chat</span>
										</Button>
									</div>

									{/* Editor content */}
									<div className="flex-1 overflow-hidden">
										<FileEditorPanel filesMap={filesMap} />
									</div>
								</SheetContent>
							</Sheet>
						)}
					</div>
				</>
			)}
		</div>
	);
}

export default ChatPanel;
