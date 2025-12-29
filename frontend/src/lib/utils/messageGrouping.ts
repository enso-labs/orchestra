/**
 * Message Grouping Utilities
 *
 * Pure functions for grouping tool call messages into logical groups.
 * This enables displaying multiple related tool calls together in the UI.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type Message = {
	id: string;
	type?: 'human' | 'user' | 'ai' | 'assistant' | 'tool' | 'system';
	role?: 'human' | 'user' | 'ai' | 'assistant' | 'tool' | 'system';
	content: string;
	tool_call_chunks?: ToolCallChunk[];
	tool_calls?: ToolCallComplete[];
	tool_call_id?: string;
	name?: string;
	status?: 'success' | 'error';
	artifact?: string;
	input?: any;
	args?: any;
	model?: any; // Model info from human message
	response_metadata?: {
		finish_reason?: string;
		stop_reason?: string;
	};
};

export type ToolCallChunk = {
	name: string;
	args: string; // Incremental JSON string
	id?: string;
};

export type ToolCallComplete = {
	id: string;
	name: string;
	args: any;
};

export type ToolMessage = Message & {
	type: 'tool';
	role: 'tool';
};

export type ToolCall = {
	id: string;
	name: string;
	input: any; // Parsed args from tool_call_chunks
	output?: ToolMessage; // Matched by tool_call_id
	status: 'pending' | 'success' | 'error';
	tool_call_id?: string;
};

export type ToolCallGroup = {
	type: 'tool_group';
	id: string;
	toolCalls: ToolCall[];
};

export type RegularMessage = {
	type: 'regular';
	message: Message;
};

export type GroupedMessage = ToolCallGroup | RegularMessage;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a message is an assistant message with tool calls
 */
function isAssistantWithToolCalls(msg: Message): boolean {
	const isAssistant = msg.type === 'ai' || msg.type === 'assistant' || msg.role === 'assistant';
	const hasToolCalls = (msg.tool_call_chunks && msg.tool_call_chunks.length > 0) ||
		(msg.tool_calls && msg.tool_calls.length > 0);
	return isAssistant && !!hasToolCalls;
}

/**
 * Check if a message is a tool message (output)
 */
function isToolMessage(msg: Message): boolean {
	return msg.type === 'tool' || msg.role === 'tool';
}

/**
 * Extract tool calls from an assistant message
 */
function extractToolCalls(msg: Message): ToolCallComplete[] {
	if (msg.tool_calls && msg.tool_calls.length > 0) {
		return msg.tool_calls;
	}

	// Build from tool_call_chunks if available
	if (msg.tool_call_chunks && msg.tool_call_chunks.length > 0) {
		return msg.tool_call_chunks.map((chunk, index) => ({
			id: chunk.id || `${msg.id}-tool-${index}`,
			name: chunk.name,
			args: msg.input || chunk.args, // Use parsed input if available
		}));
	}

	return [];
}

/**
 * Generate stable group ID for React keys
 */
export function getStableGroupId(assistantMsgId: string, toolCount: number): string {
	return `tool-group-${assistantMsgId}-${toolCount}`;
}

/**
 * Correlate tool call inputs to outputs
 */
export function correlateToolCalls(
	toolCallsFromAssistant: ToolCallComplete[],
	toolMessages: ToolMessage[]
): ToolCall[] {
	const correlated: ToolCall[] = [];

	// First pass: match by tool_call_id
	for (const tc of toolCallsFromAssistant) {
		const output = toolMessages.find(tm => tm.tool_call_id === tc.id);
		correlated.push({
			id: tc.id,
			name: tc.name,
			input: tc.args,
			output,
			status: output
				? (output.status === 'error' ? 'error' : 'success')
				: 'pending',
			tool_call_id: tc.id,
		});
	}

	// Second pass: handle orphaned outputs (no matching input)
	const matchedOutputIds = new Set(
		correlated.map(c => c.output?.id).filter(Boolean)
	);
	const orphanedOutputs = toolMessages.filter(
		tm => !matchedOutputIds.has(tm.id)
	);

	for (const orphan of orphanedOutputs) {
		correlated.push({
			id: orphan.id,
			name: orphan.name || 'Unknown Tool',
			input: orphan.input || orphan.args, // Fallback to existing input field
			output: orphan,
			status: orphan.status === 'error' ? 'error' : 'success',
			tool_call_id: orphan.tool_call_id,
		});
	}

	return correlated;
}

// ============================================================================
// Main Grouping Function
// ============================================================================

/**
 * Group consecutive tool-related messages
 *
 * Algorithm:
 * 1. Scan messages sequentially
 * 2. When assistant message with tool_calls found → START new group
 * 3. Subsequent tool messages → ADD to current group
 * 4. Non-tool message → FINALIZE current group
 * 5. Correlate inputs to outputs via tool_call_id
 *
 * @param messages - Flat array of messages
 * @returns Array of grouped messages (groups and regular messages intermixed)
 */
export function groupToolMessages(messages: Message[]): GroupedMessage[] {
	if (!messages || messages.length === 0) {
		return [];
	}

	const groups: GroupedMessage[] = [];
	let currentGroup: {
		assistantMsgId: string;
		toolCalls: ToolCallComplete[];
		toolMessages: ToolMessage[];
	} | null = null;

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];

		// Start new group on assistant message with tool_calls
		if (isAssistantWithToolCalls(msg)) {
			// Finalize previous group if exists
			if (currentGroup) {
				const correlated = correlateToolCalls(
					currentGroup.toolCalls,
					currentGroup.toolMessages
				);
				if (correlated.length > 0) {
					groups.push({
						type: 'tool_group',
						id: getStableGroupId(currentGroup.assistantMsgId, correlated.length),
						toolCalls: correlated,
					});
				}
			}

			// Start new group
			currentGroup = {
				assistantMsgId: msg.id,
				toolCalls: extractToolCalls(msg),
				toolMessages: [],
			};
			continue;
		}

		// Add tool output to current group
		if (isToolMessage(msg)) {
			if (!currentGroup) {
				// Edge case: tool output without input (orphaned)
				// Create a group just for this orphaned output
				currentGroup = {
					assistantMsgId: `orphan-${msg.id}`,
					toolCalls: [],
					toolMessages: [],
				};
			}
			currentGroup.toolMessages.push(msg as ToolMessage);
			continue;
		}

		// Non-tool message: finalize current group and pass through
		if (currentGroup) {
			const correlated = correlateToolCalls(
				currentGroup.toolCalls,
				currentGroup.toolMessages
			);
			if (correlated.length > 0) {
				groups.push({
					type: 'tool_group',
					id: getStableGroupId(currentGroup.assistantMsgId, correlated.length),
					toolCalls: correlated,
				});
			}
			currentGroup = null;
		}

		// Pass through regular message
		groups.push({ type: 'regular', message: msg });
	}

	// Finalize any remaining group
	if (currentGroup) {
		const correlated = correlateToolCalls(
			currentGroup.toolCalls,
			currentGroup.toolMessages
		);
		if (correlated.length > 0) {
			groups.push({
				type: 'tool_group',
				id: getStableGroupId(currentGroup.assistantMsgId, correlated.length),
				toolCalls: correlated,
			});
		}
	}

	return groups;
}
