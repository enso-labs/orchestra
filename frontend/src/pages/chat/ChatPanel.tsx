import { ChatNav } from "@/components/nav/ChatNav";
import { ChatDrawer } from "@/components/drawers/ChatDrawer";
import ChatInput from "@/components/inputs/ChatInput";
// import ChatMessages from "@/components/lists/ChatMessages";
import ChatLayout from "@/layouts/ChatLayout";
import { useToolContext } from "@/hooks/useToolContext";
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
	const { isAssistantOpen, isDrawerOpen, setIsDrawerOpen } = useToolContext();
	const { messages, messagesEndRef, currentToolCall, handleDrawerClose } =
		useChatContext();

	return (
		<ChatLayout>
			<div
				className={`
          flex min-h-[calc(100vh-0px)] max-h-[calc(100vh-0px)] relative
          transition-all duration-200 ease-in-out
          ${isAssistantOpen ? "pr-[var(--chat-drawer-width,320px)]" : ""}
      `}
			>
				<div className="flex-1 flex flex-col overflow-hidden">
					<ChatNav onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)} />
					<div className="flex-1 overflow-y-auto p-3 min-h-0">
						<div className="space-y-4 max-w-4xl mx-auto pb-4">
							{/* <ChatMessages messages={messages} /> */}
							{messages.length > 0 &&
								messages.map((message: any) => (
									<div key={message.id} className="p-2 rounded-md my-2">
										<h3 className="text-sm font-bold">
											{message.role || message.type}{" "}
											{message.type === "user" && `[${message.model}]`}
											{message.type === "tool" && `[${message.name}]`}
										</h3>
										<p>{message.content || JSON.stringify(message.input)}</p>
									</div>
								))}
							<div ref={messagesEndRef} />
							{/* Invisible element to scroll to */}
						</div>
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
