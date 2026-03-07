import ChatInput from "@/components/inputs/ChatInput";
import ThreadSandboxStatus from "@/components/status/ThreadSandboxStatus";

interface ChatComposerProps {
	showAgentMenu?: boolean;
	showSandboxStatus?: boolean;
}

export default function ChatComposer({
	showAgentMenu = false,
	showSandboxStatus = false,
}: ChatComposerProps) {
	return (
		<div className="shrink-0 border-t border-border bg-background">
			<div className="max-w-4xl mx-auto px-4 pt-3 pb-4">
				<div className="flex flex-col gap-2">
					{showSandboxStatus && <ThreadSandboxStatus />}
					<ChatInput showAgentMenu={showAgentMenu} />
				</div>
			</div>
		</div>
	);
}
