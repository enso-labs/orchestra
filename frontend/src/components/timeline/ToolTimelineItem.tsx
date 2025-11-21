import { useState, lazy, Suspense } from "react";
import { ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { truncateFrom } from "@/lib/utils/format";
import MarkdownCard from "../cards/MarkdownCard";
import DefaultTool from "../tools/Default";
import SearchEngineTool from "../tools/SearchEngine";

// Lazy load heavy Plotly-based component
const ChartRenderWidget = lazy(() => import("../tools/ChartRenderWidget"));

const MAX_LENGTH = 1000;

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

interface ToolTimelineItemProps {
	message: ToolMessage;
	maxPreviewLength?: number;
}

function isValidJSON(str: string): boolean {
	try {
		JSON.parse(str);
		return true;
	} catch {
		return false;
	}
}

function ToolContent({
	message,
	maxLength = MAX_LENGTH,
}: {
	message: ToolMessage;
	maxLength?: number;
}): { element: React.ReactNode; hasOwnScroll: boolean } {
	if (["search_engine", "web_search"].includes(message.name)) {
		return {
			element: <SearchEngineTool selectedToolMessage={message} />,
			hasOwnScroll: true,
		};
	}

	if (["get_stock_price_history"].includes(message.name)) {
		return {
			element: (
				<div className="w-full overflow-hidden rounded-lg border border-border">
					<Suspense fallback={<div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
						<ChartRenderWidget content={message.artifact} />
					</Suspense>
				</div>
			),
			hasOwnScroll: false,
		};
	}

	// Check if message.content is valid JSON
	if (
		message.content &&
		typeof message.content === "string" &&
		isValidJSON(message.content)
	) {
		return {
			element: <DefaultTool selectedToolMessage={message} collapsed={true} />,
			hasOwnScroll: false,
		};
	}

	return {
		element: (
			<MarkdownCard
				content={truncateFrom(message.content, "end", "...", maxLength)}
			/>
		),
		hasOwnScroll: false,
	};
}

export default function ToolTimelineItem({
	message,
	maxPreviewLength = 100,
}: ToolTimelineItemProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	// Get preview text from content
	const getPreviewText = () => {
		if (!message.content) return "No content";
		if (typeof message.content !== "string") {
			return JSON.stringify(message.content).slice(0, maxPreviewLength);
		}
		return (
			message.content.slice(0, maxPreviewLength) +
			(message.content.length > maxPreviewLength ? "..." : "")
		);
	};

	const isSuccess = message.status === "success";

	return (
		<div className="bg-muted/50 rounded-lg border border-border/50 overflow-hidden">
			{/* Header - always visible */}
			<div
				className="flex items-center justify-between cursor-pointer p-3 hover:bg-muted/80 transition-colors"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="flex items-center gap-2 min-w-0 flex-1">
					<div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
						<Wrench className="h-3 w-3 text-primary" />
					</div>
					<span
						className={cn(
							"text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0",
							isSuccess
								? "bg-green-500/20 text-green-500"
								: "bg-red-500/20 text-red-500",
						)}
					>
						{message.name}
					</span>
					{!isExpanded && (
						<span className="text-xs text-muted-foreground truncate">
							{getPreviewText()}
						</span>
					)}
				</div>
				<button className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0 ml-2">
					{isExpanded ? (
						<ChevronUp className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					)}
				</button>
			</div>

			{/* Expanded content */}
			{isExpanded && (
				<div className="px-3 pb-3 border-t border-border/50">
					{message.tool_call_id && (
						<p className="text-xs text-muted-foreground mt-2 mb-2 font-mono">
							{message.tool_call_id}
						</p>
					)}
					{(() => {
						const { element, hasOwnScroll } = ToolContent({ message });
						return hasOwnScroll ? (
							element
						) : (
							<div className="max-h-[400px] overflow-auto">{element}</div>
						);
					})()}
				</div>
			)}
		</div>
	);
}
