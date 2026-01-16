/**
 * Human-In-The-Loop (HITL) Interrupt Types
 *
 * These types mirror the backend schemas for interrupt handling,
 * enabling tool approval workflows in the chat interface.
 */

// Decision types matching backend DecisionType enum
export type DecisionType = "approve" | "edit" | "reject" | "respond";

// Interrupt status matching backend InterruptStatus enum
export type InterruptStatus =
	| "pending"
	| "approved"
	| "edited"
	| "rejected"
	| "responded"
	| "expired"
	| "timeout";

// Interrupt trigger types
export type InterruptTrigger = "tool_call" | "manual" | "threshold";

/**
 * Configuration for HITL behavior on an assistant
 */
export interface InterruptConfig {
	enabled: boolean;
	tools_requiring_approval: string[];
	timeout_seconds: number;
	default_action: "approve" | "reject" | "timeout";
	allow_approve: boolean;
	allow_edit: boolean;
	allow_reject: boolean;
}

/**
 * Default interrupt configuration
 */
export const DEFAULT_INTERRUPT_CONFIG: InterruptConfig = {
	enabled: false,
	tools_requiring_approval: [],
	timeout_seconds: 300,
	default_action: "timeout",
	allow_approve: true,
	allow_edit: true,
	allow_reject: true,
};

/**
 * Request to resume a thread after an interrupt decision
 */
export interface InterruptRequest {
	interrupt_id: string;
	action: DecisionType;
	edited_args?: Record<string, unknown>;
	reason?: string;
	nonce?: string;
}

/**
 * Response after handling an interrupt decision
 */
export interface InterruptResponse {
	status: string;
	interrupt_id: string;
	thread_id: string;
	message: string;
}

/**
 * Interrupt event data received via SSE
 */
export interface InterruptEventData {
	thread_id: string;
	checkpoint_id: string;
	tool_name: string;
	tool_args: Record<string, unknown>;
	tool_call_id: string;
	tool_description?: string;
	reason: string;
	timeout_at: string;
	created_at: string;
}

/**
 * Full interrupt object with all metadata
 */
export interface Interrupt {
	id: string;
	thread_id: string;
	user_id: string;
	checkpoint_id: string;
	tool_name: string;
	tool_args: Record<string, unknown>;
	tool_call_id: string;
	tool_description?: string;
	reason: string;
	status: InterruptStatus;
	nonce: string;
	created_at: string;
	expires_at: string;
	resolved_at?: string;
	decision?: {
		action: string;
		edited_args?: Record<string, unknown>;
		reason?: string;
	};
}

/**
 * List of interrupts response
 */
export interface InterruptList {
	interrupts: Interrupt[];
}

/**
 * State for managing interrupts in the UI
 */
export interface InterruptState {
	// Current pending interrupt requiring user action
	pendingInterrupt: Interrupt | null;
	// All pending interrupts for the current thread
	pendingInterrupts: Interrupt[];
	// Loading state for interrupt operations
	isLoading: boolean;
	// Error message if any
	error: string | null;
	// Whether the interrupt dialog should be shown
	showDialog: boolean;
}

/**
 * Actions for interrupt state management
 */
export interface InterruptActions {
	// Set a pending interrupt from SSE event
	setPendingInterrupt: (interrupt: Interrupt | null) => void;
	// Handle interrupt from SSE stream data
	handleInterruptEvent: (data: InterruptEventData) => void;
	// Submit a decision for an interrupt
	submitDecision: (request: InterruptRequest) => Promise<InterruptResponse>;
	// Fetch pending interrupts for a thread (e.g., on reconnect)
	fetchPendingInterrupts: (threadId: string) => Promise<void>;
	// Clear all interrupt state
	clearInterrupts: () => void;
	// Show/hide the interrupt dialog
	setShowDialog: (show: boolean) => void;
}

/**
 * Combined interrupt context type
 */
export type InterruptContextType = InterruptState & InterruptActions;

/**
 * Check if a stream chunk contains an interrupt event
 */
export function isInterruptEvent(
	chunk: unknown,
): chunk is ["__interrupt__", InterruptEventData] {
	if (!Array.isArray(chunk) || chunk.length < 2) return false;
	return chunk[0] === "__interrupt__";
}

/**
 * Parse an interrupt event from SSE data
 */
export function parseInterruptEvent(data: string): InterruptEventData | null {
	try {
		const parsed = JSON.parse(data);
		if (isInterruptEvent(parsed)) {
			return parsed[1];
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Calculate remaining time until interrupt expires
 */
export function getInterruptTimeRemaining(interrupt: Interrupt): number {
	const expiresAt = new Date(interrupt.expires_at).getTime();
	const now = Date.now();
	return Math.max(0, expiresAt - now);
}

/**
 * Check if an interrupt has expired
 */
export function isInterruptExpired(interrupt: Interrupt): boolean {
	return getInterruptTimeRemaining(interrupt) <= 0;
}

/**
 * Format tool arguments for display
 */
export function formatToolArgs(args: Record<string, unknown>): string {
	return JSON.stringify(args, null, 2);
}
