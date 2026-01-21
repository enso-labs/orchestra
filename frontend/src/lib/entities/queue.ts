/**
 * Message queue type definitions for frontend message queueing system.
 * Allows users to submit multiple messages while a stream is in progress.
 */

/**
 * A message waiting in the queue to be processed.
 */
export interface QueuedMessage {
	/** Unique identifier for the queued message */
	id: string;
	/** The message text content */
	query: string;
	/** Optional images attached to the message */
	images: File[];
	/** Timestamp when the message was queued */
	queuedAt: number;
}

/**
 * Configuration options for the useMessageQueue hook.
 */
export interface UseMessageQueueConfig {
	/** Whether a stream is currently active (controller !== null) */
	isStreaming: boolean;
	/** Function to execute when processing a queued message */
	executeSubmit: (query?: string, images?: File[]) => Promise<void> | void;
}

/**
 * Return type for the useMessageQueue hook.
 */
export interface UseMessageQueueReturn {
	// State (triggers re-renders only for UI needs)
	/** Number of messages currently in the queue */
	queueLength: number;
	/** Whether a message is currently being processed */
	isProcessing: boolean;
	/** Array of all queued messages for UI display */
	queuedItems: QueuedMessage[];
	/** ID of the message currently being edited (null if none) */
	editingId: string | null;

	// Actions (stable via useCallback)
	/** Add a new message to the queue */
	enqueue: (query: string, images?: File[]) => void;
	/** Remove a specific message from the queue by ID */
	dequeue: (id: string) => void;
	/** Clear all messages from the queue */
	clearQueue: () => void;
	/** Update a queued message's query text */
	updateQueuedMessage: (id: string, query: string) => void;
	/** Set the ID of the message being edited (null to clear) */
	setEditingId: (id: string | null) => void;

	// Computed
	/** Whether there are any messages in the queue */
	hasQueuedMessages: boolean;
}
