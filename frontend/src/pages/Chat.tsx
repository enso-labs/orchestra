import ChatLayout from "../layouts/ChatLayout";
import { useChatContext } from "../context/ChatContext";
import { ThreadHistoryDrawer } from "@/components/drawers/ThreadHistoryDrawer";
import { useEffect } from "react";
import { ChatNav } from "@/components/nav/ChatNav";
import ChatInput from "@/components/inputs/ChatInput";
import ChatMessages from "@/components/lists/ChatMessages";
import ChatSection from "@/components/sections/chat-section";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/context/AppContext";
import SelectModel from "@/components/lists/SelectModel";
import { useSearchParams } from "react-router-dom";
import { useAgentContext } from "@/context/AgentContext";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import FileEditorPanel from "@/components/panels/FileEditorPanel";

export default function Chat() {
	const { loading, isDrawerOpen, setIsDrawerOpen } = useAppContext();
	const { useEffectGetAgents } = useAgentContext();
	const {
		messages,
		useListThreadsEffect,
		useListCheckpointsEffect,
		metadata,
		useEffectUpdateAssistantId,
		viewMode,
		filesMap,
	} = useChatContext();
	const [, setSearchParams] = useSearchParams();
	const isAssistantOpen = false;

	useEffectGetAgents();
	useEffectUpdateAssistantId();

	// Scroll behavior is now handled entirely by ChatMessages component
	// to prevent conflicting scroll mechanisms and twitchy behavior

	useListThreadsEffect(!loading);
	useListCheckpointsEffect(!loading, metadata);

	useEffect(() => {
		return () => {
			setSearchParams(new URLSearchParams());
		};
	}, []);

	if (messages.length === 0) {
		return (
			<ChatLayout>
				<div
					className={`
            flex h-full relative
            transition-all duration-200 ease-in-out
            ${isAssistantOpen ? "pr-[var(--chat-drawer-width,320px)]" : ""}
        `}
				>
					<ThreadHistoryDrawer
						isOpen={isDrawerOpen}
						onClose={() => setIsDrawerOpen(false)}
					/>

					<div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
						<div className="absolute top-4 left-4">
							<Button
								onClick={() => setIsDrawerOpen(!isDrawerOpen)}
								variant="outline"
								size="icon"
							>
								<Menu className="h-5 w-5" />
							</Button>
						</div>
						<div className="absolute top-4 right-4">
							<div className="flex flex-row gap-2 items-center">
								<SelectModel />
								<div className="flex-shrink-0">
									<ColorModeButton />
								</div>
							</div>
						</div>
						<ChatSection />
					</div>
				</div>
			</ChatLayout>
		);
	}

	return (
		<ChatLayout>
			<div className="flex h-full relative">
				<ThreadHistoryDrawer
					isOpen={isDrawerOpen}
					onClose={() => setIsDrawerOpen(false)}
				/>

				{viewMode === "chat" ? (
					// CHAT MODE (Default) - Full-width chat
					<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
						<ChatNav />
						<div className="flex-1 min-h-0">
							<ChatMessages messages={messages} />
						</div>
						<div className="sticky bottom-0 bg-background border-border">
							<div className="max-w-4xl mx-auto">
								<div className="flex flex-col gap-2 px-4 pb-4">
									<ChatInput showAgentMenu={true} />
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
								<ChatNav />
								<div className="flex-1 min-h-0">
									<ChatMessages messages={messages} />
								</div>
								<div className="sticky bottom-0 bg-background border-border">
									<div className="max-w-4xl mx-auto">
										<div className="flex flex-col gap-2 px-4 pb-4">
											<ChatInput showAgentMenu={true} />
										</div>
									</div>
								</div>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				)}
			</div>
		</ChatLayout>
	);
}
