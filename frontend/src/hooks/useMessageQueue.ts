import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	QueuedMessage,
	UseMessageQueueConfig,
	UseMessageQueueReturn,
} from "@/lib/entities/queue";

/**
 * Custom hook for managing a frontend message queue.
 *
 * Allows users to submit multiple messages while a stream is in progress.
 * Messages are queued and processed sequentially (FIFO) when the current
 * stream completes.
 *
 * Uses a ref-based queue for synchronous access (no re-renders on add/remove)
 * with minimal state updates only for UI-reactive values (queueLength, isProcessing).
 *
 * @param config - Configuration object with isStreaming flag and executeSubmit function
 * @returns Queue state and actions
 *
 * @example
 * ```tsx
 * const queueHooks = useMessageQueue({
 *   isStreaming: !!controller,
 *   executeSubmit: handleSubmit,
 * });
 *
 * // Add a message to the queue
 * queueHooks.enqueue("Hello, world!", []);
 *
 * // Check queue status
 * if (queueHooks.hasQueuedMessages) {
 *   console.log(`${queueHooks.queueLength} messages waiting`);
 * }
 * ```
 */
export function useMessageQueue(
	config: UseMessageQueueConfig,
): UseMessageQueueReturn {
	const { isStreaming, executeSubmit } = config;

	// Ref for synchronous access - no re-renders on queue changes
	const queueRef = useRef<QueuedMessage[]>([]);

	// State only for UI - minimal re-renders
	const [queueLength, setQueueLength] = useState(0);
	const [isProcessing, setIsProcessing] = useState(false);
	// State for UI display of queue items (triggers re-renders when queue changes)
	const [queuedItems, setQueuedItems] = useState<QueuedMessage[]>([]);
	// Track which message is being edited (skip processing if first item is being edited)
	const [editingId, setEditingId] = useState<string | null>(null);

	// Track previous streaming state for edge detection
	const prevStreamingRef = useRef(isStreaming);

	// Guard to prevent concurrent processNext calls
	const processingRef = useRef(false);

	// Ref to track editingId for use in processNext callback
	const editingIdRef = useRef<string | null>(null);
	editingIdRef.current = editingId;

	/**
	 * Generate a unique ID for a queued message.
	 */
	const generateId = useCallback((): string => {
		return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	}, []);

	/**
	 * Process the next message in the queue.
	 * Internal function - not exposed in return value.
	 * Skips processing if the first message is currently being edited.
	 */
	const processNext = useCallback(async () => {
		// Guard against concurrent processing
		if (processingRef.current) return;
		if (queueRef.current.length === 0) return;

		// Skip processing if the first message is being edited
		const firstMessage = queueRef.current[0];
		if (editingIdRef.current === firstMessage.id) {
			return;
		}

		processingRef.current = true;
		setIsProcessing(true);

		// Pop the first message from the queue
		const [nextMessage, ...rest] = queueRef.current;
		queueRef.current = rest;
		setQueueLength(rest.length);
		setQueuedItems([...rest]);

		try {
			await executeSubmit(nextMessage.query, nextMessage.images);
		} catch (error) {
			console.error("Error processing queued message:", error);
			// On error, preserve the queue (don't lose remaining messages)
		} finally {
			processingRef.current = false;
			setIsProcessing(false);
		}
	}, [executeSubmit]);

	/**
	 * Sync queuedItems state with queueRef for UI updates.
	 */
	const syncQueueState = useCallback(() => {
		setQueueLength(queueRef.current.length);
		setQueuedItems([...queueRef.current]);
	}, []);

	/**
	 * Add a message to the queue.
	 * If not currently streaming, processes immediately.
	 */
	const enqueue = useCallback(
		(query: string, images: File[] = []) => {
			const newMessage: QueuedMessage = {
				id: generateId(),
				query,
				images,
				queuedAt: Date.now(),
			};

			queueRef.current = [...queueRef.current, newMessage];
			syncQueueState();

			// If not streaming, process immediately
			if (!isStreaming && !processingRef.current) {
				processNext();
			}
		},
		[generateId, isStreaming, processNext, syncQueueState],
	);

	/**
	 * Remove a specific message from the queue by ID.
	 */
	const dequeue = useCallback(
		(id: string) => {
			queueRef.current = queueRef.current.filter((msg) => msg.id !== id);
			syncQueueState();
		},
		[syncQueueState],
	);

	/**
	 * Clear all messages from the queue.
	 */
	const clearQueue = useCallback(() => {
		queueRef.current = [];
		setQueueLength(0);
		setQueuedItems([]);
	}, []);

	/**
	 * Update a queued message's query text.
	 */
	const updateQueuedMessage = useCallback(
		(id: string, query: string) => {
			queueRef.current = queueRef.current.map((msg) =>
				msg.id === id ? { ...msg, query } : msg,
			);
			syncQueueState();
		},
		[syncQueueState],
	);

	/**
	 * Auto-process effect - fires when stream completes (isStreaming: true -> false).
	 * Uses edge detection to only trigger on the transition, not continuously.
	 */
	useEffect(() => {
		const wasStreaming = prevStreamingRef.current;
		prevStreamingRef.current = isStreaming;

		// Stream just completed - process next if queue has items
		if (wasStreaming && !isStreaming && queueRef.current.length > 0) {
			// Small delay to ensure stream is fully closed
			setTimeout(() => {
				processNext();
			}, 100);
		}
	}, [isStreaming, processNext]);

	/**
	 * Navigation warning - warn user before leaving with queued messages.
	 */
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (queueRef.current.length > 0) {
				e.preventDefault();
				// Modern browsers require returnValue to be set
				e.returnValue =
					"You have messages in the queue. Are you sure you want to leave?";
				return e.returnValue;
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, []);

	// Computed value
	const hasQueuedMessages = queueLength > 0;

	return useMemo(
		() => ({
			// State
			queueLength,
			isProcessing,
			queuedItems,
			editingId,

			// Actions
			enqueue,
			dequeue,
			clearQueue,
			updateQueuedMessage,
			setEditingId,

			// Computed
			hasQueuedMessages,
		}),
		[
			queueLength,
			isProcessing,
			queuedItems,
			editingId,
			enqueue,
			dequeue,
			clearQueue,
			updateQueuedMessage,
			hasQueuedMessages,
		],
	);
}

export default useMessageQueue;
