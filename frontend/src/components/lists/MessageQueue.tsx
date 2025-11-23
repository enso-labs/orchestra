import { useChatContext } from "@/context/ChatContext";
import { X, Image as ImageIcon } from "lucide-react";
import { Button } from "../ui/button";
import { QueuedMessage } from "@/hooks/useChat";

export default function MessageQueue() {
	const { messageQueue, removeFromQueue } = useChatContext();

	if (!messageQueue || messageQueue.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-col gap-1 px-4 py-2 bg-muted/50 rounded-t-lg border border-b-0 border-input">
			<div className="text-xs text-muted-foreground font-medium">
				Queued messages ({messageQueue.length})
			</div>
			<div className="flex flex-col gap-1">
				{messageQueue.map((msg: QueuedMessage, index: number) => (
					<div
						key={msg.id}
						className="flex items-center justify-between gap-2 bg-background rounded-md px-3 py-2 text-sm border border-input"
					>
						<div className="flex items-center gap-2 flex-1 min-w-0">
							<span className="text-xs text-muted-foreground font-mono shrink-0">
								{index + 1}.
							</span>
							<span className="truncate flex-1">{msg.content}</span>
							{msg.images.length > 0 && (
								<span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
									<ImageIcon className="h-3 w-3" />
									{msg.images.length}
								</span>
							)}
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 shrink-0 hover:bg-destructive/10 hover:text-destructive"
							onClick={() => removeFromQueue(msg.id)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}
