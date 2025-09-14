import { ChatNav } from "@/components/nav/ChatNav";
import { ChatDrawer } from "@/components/drawers/ChatDrawer";
import ChatInput from "@/components/inputs/ChatInput";
import ChatMessages from "@/components/lists/ChatMessages";
import ChatLayout from "@/layouts/ChatLayout";
import { useChatContext } from "@/context/ChatContext";
import DefaultTool from "@/components/tools/Default";
import SearchEngineTool from "@/components/tools/SearchEngine";

function ToolAction({ selectedToolMessage }: { selectedToolMessage: any }) {
	if (selectedToolMessage)
		return (
			<>
				{selectedToolMessage.name === "search_engine" ? (
					<SearchEngineTool selectedToolMessage={selectedToolMessage} />
				) : selectedToolMessage.name === "available_tools" ? (
					<DefaultTool selectedToolMessage={selectedToolMessage} />
				) : (
					<DefaultTool selectedToolMessage={selectedToolMessage} />
				)}
			</>
		);
}

function ChatPanel() {
	const { messages, currentToolCall, handleDrawerClose } = useChatContext();
	const isAssistantOpen = false;

	return (
		<ChatLayout>
			<div
				className={`
          flex h-full relative
          transition-all duration-200 ease-in-out
          ${isAssistantOpen ? "pr-[var(--chat-drawer-width,320px)]" : ""}
      `}
			>
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ChatNav onMenuClick={() => {}} />
					<div className="flex-1 min-h-0">
						<ChatMessages messages={messages} />
					</div>

					<div className="sticky bottom-0 bg-background border-border">
						<div className="max-w-4xl mx-auto">
							<div className="flex flex-col gap-2 p-4 pb-25">
								<ChatInput />
							</div>
						</div>
					</div>
				</div>

				<ChatDrawer isOpen={isAssistantOpen} onClose={handleDrawerClose}>
					{currentToolCall && (
						<ToolAction selectedToolMessage={currentToolCall} />
					)}
				</ChatDrawer>
			</div>
		</ChatLayout>
	);
}

export default ChatPanel;
