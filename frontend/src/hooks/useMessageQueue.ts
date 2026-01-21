import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
	QueuedMessage,
	UseMessageQueueConfig,
	UseMessageQueueReturn,
} from "@/lib/entities/queue";

/** Maximum number of retry attempts before dropping a message */
const MAX_RETRIES = 3;

/** Maximum number of messages allowed in the queue */
const MAX_QUEUE_SIZE = 10;

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
	 * 
	 * Only removes the message from the queue after successful submission.
	 * On failure, increments retryCount and re-attempts on next cycle.
	 * Drops the message and notifies the user if maxRetries is exceeded.
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

		// Check if message has exceeded max retries before attempting
		if (firstMessage.retryCount >= MAX_RETRIES) {
			// Drop the message and notify user
			const [, ...rest] = queueRef.current;
			queueRef.current = rest;
			setQueueLength(rest.length);
			setQueuedItems([...rest]);
			
			toast.error("Message dropped after max retries", {
				description: `Failed to send: "${firstMessage.query.slice(0, 50)}${firstMessage.query.length > 50 ? "..." : ""}"`,
			});
			
			// Continue processing next message if any
			if (rest.length > 0) {
				setTimeout(() => processNext(), 100);
			}
			return;
		}

		processingRef.current = true;
		setIsProcessing(true);

		try {
			await executeSubmit(firstMessage.query, firstMessage.images);
			
			// Success - remove the message from the queue
			const [, ...rest] = queueRef.current;
			queueRef.current = rest;
			setQueueLength(rest.length);
			setQueuedItems([...rest]);
		} catch (error) {
			console.error("Error processing queued message:", error);
			
			// Increment retry count on the message at the front of the queue
			const updatedMessage: QueuedMessage = {
				...firstMessage,
				retryCount: firstMessage.retryCount + 1,
			};
			queueRef.current = [updatedMessage, ...queueRef.current.slice(1)];
			setQueuedItems([...queueRef.current]);
			
			// Notify user of retry
			if (updatedMessage.retryCount < MAX_RETRIES) {
				toast.warning(`Message will retry (${updatedMessage.retryCount}/${MAX_RETRIES})`, {
					description: `Failed to send: "${firstMessage.query.slice(0, 50)}${firstMessage.query.length > 50 ? "..." : ""}"`,
				});
			}
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
	 * Enforces MAX_QUEUE_SIZE limit by dropping oldest messages if necessary.
	 *
	 * @returns true if message was added successfully, false if rejected
	 */
	const enqueue = useCallback(
		(query: string, images: File[] = []): boolean => {
			// Enforce MAX_QUEUE_SIZE: drop oldest messages to make room
			if (queueRef.current.length >= MAX_QUEUE_SIZE) {
				const droppedCount = queueRef.current.length - MAX_QUEUE_SIZE + 1;
				const droppedMessages = queueRef.current.slice(0, droppedCount);

				// Remove oldest message(s) to make room
				queueRef.current = queueRef.current.slice(droppedCount);

				// Log warning for dropped messages
				console.warn(
					`[MessageQueue] Queue full (${MAX_QUEUE_SIZE}). Dropped ${droppedCount} oldest message(s):`,
					droppedMessages.map((m) => m.query.slice(0, 50)),
				);
			}

			const newMessage: QueuedMessage = {
				id: generateId(),
				query,
				images,
				queuedAt: Date.now(),
				retryCount: 0,
			};

			queueRef.current = [...queueRef.current, newMessage];
			syncQueueState();

			// If not streaming, process immediately
			if (!isStreaming && !processingRef.current) {
				processNext();
			}

			return true;
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

	// Track previous editingId for edge detection
	const prevEditingIdRef = useRef<string | null>(null);

	/**
	 * Auto-process effect - fires when stream completes (isStreaming: true -> false).
	 * Uses edge detection to only trigger on the transition, not continuously.
	 */
	useEffect(() => {
		const wasStreaming = prevStreamingRef.current;
		prevStreamingRef.current = isStreaming;

		let timerId: ReturnType<typeof setTimeout> | undefined;

		// Stream just completed - process next if queue has items
		if (wasStreaming && !isStreaming && queueRef.current.length > 0) {
			// Small delay to ensure stream is fully closed
			timerId = setTimeout(() => {
				processNext();
			}, 100);
		}

		return () => {
			if (timerId !== undefined) {
				clearTimeout(timerId);
			}
		};
	}, [isStreaming, processNext]);

	/**
	 * Resume processing when editing ends (editingId changes from value to null).
	 * If user was editing the first item and stops, we should process it now.
	 */
	useEffect(() => {
		const wasEditing = prevEditingIdRef.current;
		prevEditingIdRef.current = editingId;

		let timerId: ReturnType<typeof setTimeout> | undefined;

		// Editing just ended - process next if not streaming and queue has items
		if (wasEditing !== null && editingId === null && !isStreaming && queueRef.current.length > 0) {
			// Small delay to ensure edit state is fully updated
			timerId = setTimeout(() => {
				processNext();
			}, 100);
		}

		return () => {
			if (timerId !== undefined) {
				clearTimeout(timerId);
			}
		};
	}, [editingId, isStreaming, processNext]);

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
