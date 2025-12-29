/**
 * ToolCallGroup Component
 *
 * Displays a group of related tool calls in a collapsible container.
 * Shows aggregate status, tool count, and expands to reveal individual tool timeline.
 */

import { useState } from 'react';
import { ChevronDown, Wrench, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
import ToolTimeline from '@/components/timeline/ToolTimeline';
import type { ToolCall } from '@/lib/utils/messageGrouping';

// ============================================================================
// Types
// ============================================================================

interface ToolCallGroupProps {
	toolCalls: ToolCall[];
	isLatest?: boolean;
	defaultExpanded?: boolean;
}

type GroupStatus = 'success' | 'error' | 'pending';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate aggregate status for the tool group
 * - All success → 'success'
 * - Any error → 'error'
 * - Any pending → 'pending'
 */
function getGroupStatus(toolCalls: ToolCall[]): GroupStatus {
	if (toolCalls.some(tc => tc.status === 'error')) {
		return 'error';
	}
	if (toolCalls.some(tc => tc.status === 'pending')) {
		return 'pending';
	}
	return 'success';
}

/**
 * Get status indicator styling and icon
 */
function getStatusIndicator(status: GroupStatus) {
	switch (status) {
		case 'success':
			return {
				dotClass: 'bg-green-500/20 border-green-500',
				icon: CheckCircle2,
				iconClass: 'text-green-500',
				label: 'All tools completed successfully',
			};
		case 'error':
			return {
				dotClass: 'bg-red-500/20 border-red-500',
				icon: XCircle,
				iconClass: 'text-red-500',
				label: 'One or more tools failed',
			};
		case 'pending':
			return {
				dotClass: 'bg-yellow-500/20 border-yellow-500 animate-pulse',
				icon: Loader2,
				iconClass: 'text-yellow-500 animate-spin',
				label: 'Tools in progress',
			};
	}
}

/**
 * Get preview text for collapsed state
 */
function getPreviewText(toolCalls: ToolCall[]): string {
	if (toolCalls.length === 0) return '';
	if (toolCalls.length === 1) {
		return toolCalls[0].name;
	}
	// Show first tool name + count
	return `${toolCalls[0].name} and ${toolCalls.length - 1} more`;
}

// ============================================================================
// Component
// ============================================================================

export default function ToolCallGroup({
	toolCalls,
	defaultExpanded = false,
}: ToolCallGroupProps) {
	const [isOpen, setIsOpen] = useState(defaultExpanded);

	if (!toolCalls || toolCalls.length === 0) {
		return null;
	}

	const status = getGroupStatus(toolCalls);
	const statusInfo = getStatusIndicator(status);
	const StatusIcon = statusInfo.icon;
	const previewText = getPreviewText(toolCalls);
	const toolCount = toolCalls.length;

	// Convert ToolCall[] to ToolMessage[] for ToolTimeline
	const toolMessages = toolCalls.map(tc => ({
		id: tc.output?.id || tc.id,
		name: tc.name,
		content: tc.output?.content || '',
		status: tc.status === 'error' ? 'error' : tc.status === 'success' ? 'success' : undefined,
		tool_call_id: tc.tool_call_id,
		artifact: tc.output?.artifact,
		args: tc.output?.args,
		input: tc.input,
	}));

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<div className="bg-muted/30 rounded-lg border border-border/50">
				{/* Header */}
				<CollapsibleTrigger asChild>
					<div
						className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer rounded-lg"
						role="button"
						aria-label={`Tool Call Execution: ${toolCount} ${toolCount === 1 ? 'tool' : 'tools'}, ${statusInfo.label}`}
					>
						{/* Status Icon */}
						<div className="flex-shrink-0">
							<StatusIcon className={`h-4 w-4 ${statusInfo.iconClass}`} />
						</div>

						{/* Wrench Icon */}
						<div className="flex-shrink-0">
							<Wrench className="h-4 w-4 text-muted-foreground" />
						</div>

						{/* Text Content */}
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 flex-wrap">
								<span className="text-sm font-medium">
									Tool Call Execution
								</span>
								<span className="text-xs text-muted-foreground">
									{toolCount} {toolCount === 1 ? 'tool' : 'tools'}
								</span>
							</div>
							{!isOpen && (
								<div className="text-xs text-muted-foreground truncate mt-0.5">
									{previewText}
								</div>
							)}
						</div>

						{/* Chevron */}
						<div className="flex-shrink-0">
							<ChevronDown
								className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
									isOpen ? 'rotate-180' : ''
								}`}
							/>
						</div>
					</div>
				</CollapsibleTrigger>

				{/* Collapsible Content */}
				<CollapsibleContent>
					<div className="px-3 pb-3">
						<ToolTimeline messages={toolMessages} />
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}
