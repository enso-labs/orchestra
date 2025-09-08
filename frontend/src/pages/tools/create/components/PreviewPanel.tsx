import { useRef } from "react";
import ChatMessages from "@/components/lists/ChatMessages";
import ChatInput from "@/components/inputs/ChatInput";
import { ChatNav } from "@/components/nav/ChatNav";

interface PreviewPanelProps {
	messages: any[];
	onMenuClick: () => void;
}

export default function PreviewPanel({
	messages,
	onMenuClick,
}: PreviewPanelProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	return (
		<div className="flex flex-col h-full">
			<ChatNav onMenuClick={onMenuClick} />

			<div className="flex-1 overflow-y-auto p-3 min-h-0">
				<div className="space-y-4 max-w-4xl mx-auto pb-4">
					<ChatMessages messages={messages} />
					<div ref={messagesEndRef} />
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
	);
}
