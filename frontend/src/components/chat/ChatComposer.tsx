import ChatInput from "@/components/inputs/ChatInput";
import ChatUtilityRow from "@/components/chat/ChatUtilityRow";

interface ChatComposerProps {
	showAgentMenu?: boolean;
	showSandboxStatus?: boolean;
}

export default function ChatComposer({
	showAgentMenu = false,
	showSandboxStatus = false,
}: ChatComposerProps) {
	return (
		<div className="relative shrink-0 bg-background">
			<div className="pointer-events-none absolute -top-8 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-background" />
			<div className="max-w-4xl mx-auto px-4 pb-4">
				<div className="flex flex-col gap-2">
					{showSandboxStatus && <ChatUtilityRow />}
					<ChatInput showAgentMenu={showAgentMenu} />
				</div>
			</div>
		</div>
	);
}
