import ChatLayout from "../layouts/ChatLayout";
import { useChatContext } from "../context/ChatContext";
import { ThreadHistoryDrawer } from "@/components/drawers/ThreadHistoryDrawer";
import { useEffect, useRef } from "react";
import { ChatNav } from "@/components/nav/ChatNav";
import ChatInput from "@/components/inputs/ChatInput";
import ChatMessages from "@/components/lists/ChatMessages";
import HomeSection from "@/components/sections/home";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/context/AppContext";
import SelectModel from "@/components/lists/SelectModel";
import { useSearchParams } from "react-router-dom";
import { useAgentContext } from "@/context/AgentContext";

export default function Chat() {
	const { loading, isDrawerOpen, setIsDrawerOpen } = useAppContext();
	const { useEffectGetAgents } = useAgentContext();
	const { messages, useListThreadsEffect, useListCheckpointsEffect, metadata } =
		useChatContext();
	const [, setSearchParams] = useSearchParams();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const isAssistantOpen = false;

	useEffectGetAgents();

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]); // Scroll when messages change

	useListThreadsEffect(!loading);
	useListCheckpointsEffect(!loading, JSON.parse(metadata));

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
						<HomeSection />
					</div>
				</div>
			</ChatLayout>
		);
	}

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

				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ChatNav onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)} />
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
			</div>
		</ChatLayout>
	);
}
