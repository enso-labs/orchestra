import { useTheme } from "@/hooks/useTheme";
import ToolTimelineItem from "./ToolTimelineItem";

interface ToolMessage {
	id: string;
	name: string;
	content: string;
	status?: string;
	tool_call_id?: string;
	artifact?: any;
	args?: any;
	input?: any;
}

interface ToolTimelineProps {
	messages: ToolMessage[];
	maxPreviewLength?: number;
}

export default function ToolTimeline({
	messages,
	maxPreviewLength = 100,
}: ToolTimelineProps) {
	const { theme } = useTheme();

	if (!messages || messages.length === 0) {
		return null;
	}

	const isDark = theme === "dark" || theme === "gray";

	return (
		<div className="tool-timeline-container w-full">
			<div className="relative">
				{/* Timeline line */}
				{messages.length > 1 && (
					<div
						className={`absolute left-3 top-6 bottom-6 w-0.5 ${
							isDark ? "bg-muted-foreground/20" : "bg-border"
						}`}
					/>
				)}

				{/* Timeline items */}
				<div className="space-y-2">
					{messages.map((message) => (
						<div key={message.id} className="relative">
							{/* Timeline dot */}
							<div
								className={`absolute left-1.5 top-3 w-3 h-3 rounded-full border-2 z-10 ${
									message.status === "success"
										? "bg-green-500/20 border-green-500"
										: "bg-red-500/20 border-red-500"
								}`}
							/>

							{/* Content */}
							<div className="ml-8">
								<ToolTimelineItem
									message={message}
									maxPreviewLength={maxPreviewLength}
								/>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
