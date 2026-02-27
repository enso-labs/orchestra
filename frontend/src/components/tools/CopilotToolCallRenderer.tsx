import { useState, useCallback } from "react";
import { useCoAgentStateRender } from "@copilotkit/react-core";
import { Loader2, Wrench, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCallEntry {
	id: string;
	nodeName: string;
	toolName?: string;
	args?: Record<string, unknown>;
	status: "inProgress" | "complete";
}

/**
 * Renders tool call state from the CopilotKit AG-UI protocol.
 * Uses useCoAgentStateRender to capture intermediate agent state
 * and displays tool calls matching Orchestra's existing ToolTimeline style.
 */
export default function CopilotToolCallRenderer() {
	const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	const toggleExpanded = useCallback((id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	useCoAgentStateRender({
		name: "deepagent",
		handler: ({ nodeName, state }) => {
			// Extract tool call info from LangGraph agent state
			const messages = state?.messages;
			if (!Array.isArray(messages)) return;

			const lastMsg = messages[messages.length - 1];
			if (!lastMsg) return;

			// Detect tool calls from AI messages (tool_calls array)
			const aiToolCalls =
				lastMsg.additional_kwargs?.tool_calls || lastMsg.tool_calls;
			if (Array.isArray(aiToolCalls) && aiToolCalls.length > 0) {
				setToolCalls((prev) => {
					const newCalls: ToolCallEntry[] = aiToolCalls.map(
						(tc: {
							id?: string;
							function?: { name?: string; arguments?: string };
						}) => ({
							id: tc.id || `${nodeName}-${Date.now()}`,
							nodeName,
							toolName: tc.function?.name || nodeName,
							args: (() => {
								try {
									return JSON.parse(tc.function?.arguments || "{}");
								} catch {
									return undefined;
								}
							})(),
							status: "inProgress" as const,
						}),
					);
					// Deduplicate by id, update existing entries
					const map = new Map(prev.map((c) => [c.id, c]));
					for (const call of newCalls) {
						map.set(call.id, call);
					}
					return Array.from(map.values());
				});
				return;
			}

			// Detect tool result messages
			if (lastMsg.type === "tool" && lastMsg.tool_call_id) {
				setToolCalls((prev) =>
					prev.map((c) =>
						c.id === lastMsg.tool_call_id
							? { ...c, status: "complete" as const }
							: c,
					),
				);
			}
		},
		render: ({ nodeName, status }) => (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				{status === "inProgress" ? (
					<Loader2 className="h-3 w-3 animate-spin" />
				) : (
					<Wrench className="h-3 w-3" />
				)}
				<span>{nodeName}</span>
			</div>
		),
	});

	if (toolCalls.length === 0) return null;

	return (
		<div className="space-y-1 px-3 md:px-5 py-1">
			{toolCalls.map((call) => {
				const isExpanded = expandedIds.has(call.id);
				const isComplete = call.status === "complete";

				return (
					<div
						key={call.id}
						className="bg-muted/50 rounded-lg border border-border/50 overflow-hidden max-w-[90vw] md:max-w-[80%]"
					>
						<div
							className="flex items-center justify-between cursor-pointer p-2 hover:bg-muted/80 transition-colors"
							onClick={() => toggleExpanded(call.id)}
						>
							<div className="flex items-center gap-2 min-w-0 flex-1">
								<div
									className={cn(
										"h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0",
										isComplete ? "bg-green-500/20" : "bg-primary/10",
									)}
								>
									{isComplete ? (
										<Wrench className="h-3 w-3 text-green-500" />
									) : (
										<Loader2 className="h-3 w-3 animate-spin text-primary" />
									)}
								</div>
								<span
									className={cn(
										"text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0",
										isComplete
											? "bg-green-500/20 text-green-500"
											: "bg-primary/20 text-primary",
									)}
								>
									{call.toolName || call.nodeName}
								</span>
								{!isExpanded && !isComplete && (
									<span className="text-xs text-muted-foreground animate-pulse">
										executing...
									</span>
								)}
							</div>
							{call.args && (
								<button className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0 ml-2">
									{isExpanded ? (
										<ChevronUp className="h-3 w-3 text-muted-foreground" />
									) : (
										<ChevronDown className="h-3 w-3 text-muted-foreground" />
									)}
								</button>
							)}
						</div>
						{isExpanded && call.args && (
							<div className="px-3 pb-2 border-t border-border/50">
								<pre className="text-xs text-muted-foreground mt-1 overflow-auto max-h-[200px] whitespace-pre-wrap">
									{JSON.stringify(call.args, null, 2)}
								</pre>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
