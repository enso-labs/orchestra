import { useState, useCallback } from "react";
import {
	Interrupt,
	InterruptEventData,
	InterruptRequest,
	InterruptResponse,
	InterruptState,
	InterruptActions,
	InterruptContextType,
} from "@/lib/entities/interrupt";
import {
	resumeThread,
	getThreadInterrupts,
} from "@/lib/services/threadService";

/**
 * Initial state for interrupt management
 */
const initialState: InterruptState = {
	pendingInterrupt: null,
	pendingInterrupts: [],
	isLoading: false,
	error: null,
	showDialog: false,
};

/**
 * Hook for managing Human-In-The-Loop (HITL) interrupt state
 *
 * This hook provides state management and actions for handling tool approval
 * workflows in the chat interface.
 *
 * @returns Interrupt state and actions
 */
export default function useInterrupt(): InterruptContextType {
	const [state, setState] = useState<InterruptState>(initialState);

	/**
	 * Set a pending interrupt (usually from SSE event)
	 */
	const setPendingInterrupt = useCallback((interrupt: Interrupt | null) => {
		setState((prev) => ({
			...prev,
			pendingInterrupt: interrupt,
			showDialog: interrupt !== null,
			error: null,
		}));
	}, []);

	/**
	 * Handle an interrupt event from SSE stream
	 * Converts SSE event data to a full Interrupt object
	 */
	const handleInterruptEvent = useCallback((data: InterruptEventData) => {
		// Use the backend-provided interrupt_id and nonce for proper tracking
		const interrupt: Interrupt = {
			id: data.interrupt_id,
			thread_id: data.thread_id,
			user_id: "", // Will be filled by backend
			checkpoint_id: data.checkpoint_id,
			tool_name: data.tool_name,
			tool_args: data.tool_args,
			tool_call_id: data.tool_call_id,
			tool_description: data.tool_description,
			reason: data.reason,
			status: "pending",
			nonce: data.nonce,
			created_at: data.created_at,
			expires_at: data.timeout_at,
		};

		setState((prev) => ({
			...prev,
			pendingInterrupt: interrupt,
			pendingInterrupts: [...prev.pendingInterrupts, interrupt],
			showDialog: true,
			error: null,
		}));
	}, []);

	/**
	 * Submit a decision for an interrupt (approve, edit, reject, or respond)
	 */
	const submitDecision = useCallback(
		async (request: InterruptRequest): Promise<InterruptResponse> => {
			setState((prev) => ({ ...prev, isLoading: true, error: null }));

			try {
				// Get thread_id from current pending interrupt
				const threadId = state.pendingInterrupt?.thread_id;
				if (!threadId) {
					throw new Error("No pending interrupt to submit decision for");
				}

				const response = await resumeThread(threadId, request);

				// Remove the resolved interrupt from pending list
				setState((prev) => ({
					...prev,
					pendingInterrupt: null,
					pendingInterrupts: prev.pendingInterrupts.filter(
						(i) => i.id !== request.interrupt_id,
					),
					isLoading: false,
					showDialog: false,
				}));

				return response;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Failed to submit decision";
				setState((prev) => ({
					...prev,
					isLoading: false,
					error: errorMessage,
				}));
				throw error;
			}
		},
		[state.pendingInterrupt],
	);

	/**
	 * Fetch pending interrupts for a thread
	 * Useful when reconnecting to a thread or on page load
	 */
	const fetchPendingInterrupts = useCallback(async (threadId: string) => {
		setState((prev) => ({ ...prev, isLoading: true, error: null }));

		try {
			const response = await getThreadInterrupts(threadId);

			// Set the first pending interrupt as the current one to show dialog
			const firstPending = response.interrupts.find(
				(i) => i.status === "pending",
			);

			setState((prev) => ({
				...prev,
				pendingInterrupts: response.interrupts,
				pendingInterrupt: firstPending || null,
				showDialog: firstPending !== undefined,
				isLoading: false,
			}));
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to fetch pending interrupts";
			setState((prev) => ({
				...prev,
				isLoading: false,
				error: errorMessage,
			}));
		}
	}, []);

	/**
	 * Clear all interrupt state
	 */
	const clearInterrupts = useCallback(() => {
		setState(initialState);
	}, []);

	/**
	 * Show or hide the interrupt dialog
	 */
	const setShowDialog = useCallback((show: boolean) => {
		setState((prev) => ({ ...prev, showDialog: show }));
	}, []);

	return {
		// State
		...state,
		// Actions
		setPendingInterrupt,
		handleInterruptEvent,
		submitDecision,
		fetchPendingInterrupts,
		clearInterrupts,
		setShowDialog,
	};
}

/**
 * Helper to create an approve decision request
 */
export function createApproveRequest(interruptId: string): InterruptRequest {
	return {
		interrupt_id: interruptId,
		action: "approve",
		nonce: crypto.randomUUID(),
	};
}

/**
 * Helper to create an edit decision request
 */
export function createEditRequest(
	interruptId: string,
	editedArgs: Record<string, unknown>,
): InterruptRequest {
	return {
		interrupt_id: interruptId,
		action: "edit",
		edited_args: editedArgs,
		nonce: crypto.randomUUID(),
	};
}

/**
 * Helper to create a reject decision request
 */
export function createRejectRequest(
	interruptId: string,
	reason?: string,
): InterruptRequest {
	return {
		interrupt_id: interruptId,
		action: "reject",
		reason: reason || "User rejected the tool call",
		nonce: crypto.randomUUID(),
	};
}

/**
 * Helper to create a respond decision request
 */
export function createRespondRequest(
	interruptId: string,
	feedback: string,
): InterruptRequest {
	return {
		interrupt_id: interruptId,
		action: "respond",
		reason: feedback,
		nonce: crypto.randomUUID(),
	};
}
