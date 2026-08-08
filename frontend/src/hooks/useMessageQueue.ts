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
 * Time window (ms) within which an identical, non-empty enqueue is treated as
 * an accidental double-submit (double-click / double-Enter) and rejected.
 */
const DEDUP_WINDOW_MS = 1500;

/**
 * Quiet period (ms) after the last drop before the drop counter resets. Drops
 * arriving closer together than this are treated as one outage cascade and
 * accumulate into a single toast rather than starting a new one.
 */
const DROP_WINDOW_MS = 5000;

/**
 * One fixed id for every "gave up on this message" notification.
 *
 * Sonner keyed by `id` replaces in place rather than stacking, so an outage
 * that exhausts every queued message renders exactly one toast. This is the
 * load-bearing dedupe mechanism — do not vary it per call site.
 */
const MESSAGE_QUEUE_DROP_TOAST_ID = "message-queue-dropped";

/**
 * One fixed id for every "still trying" notification. Deliberately DISTINCT
 * from the drop id: "will retry" and "gave up" are different states, and
 * sharing an id would let one clobber the other.
 */
const MESSAGE_QUEUE_RETRY_TOAST_ID = "message-queue-retry";

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

	// Tracks the last accepted enqueue so an identical-content message arriving
	// within DEDUP_WINDOW_MS (a double-click / double-Enter) can be rejected.
	const lastEnqueueRef = useRef<{ query: string; at: number } | null>(null);

	// Windowed drop counter: how many messages the current cascade has dropped,
	// and when the last drop happened. Together they collapse an outage that
	// exhausts the whole queue into one accumulating toast.
	const droppedCountRef = useRef(0);
	const lastDropAtRef = useRef<number | null>(null);

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

			// Accumulate drops that land inside one quiet window into a single
			// toast keyed by a fixed id, so an outage that exhausts the whole
			// queue cannot emit one toast per message.
			const now = Date.now();
			const lastDropAt = lastDropAtRef.current;
			droppedCountRef.current =
				lastDropAt !== null && now - lastDropAt < DROP_WINDOW_MS
					? droppedCountRef.current + 1
					: 1;
			lastDropAtRef.current = now;

			const droppedCount = droppedCountRef.current;
			toast.error(
				droppedCount === 1
					? "Message dropped after max retries"
					: `${droppedCount} messages dropped after max retries`,
				{
					id: MESSAGE_QUEUE_DROP_TOAST_ID,
					// A single message's preview would describe only one of N, so
					// the aggregate case says how it failed instead of which one.
					description:
						droppedCount === 1
							? `Failed to send: "${firstMessage.query.slice(0, 50)}${firstMessage.query.length > 50 ? "..." : ""}"`
							: `Each message failed to send after ${MAX_RETRIES} attempts.`,
				},
			);

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
				toast.warning(
					`Message will retry (${updatedMessage.retryCount}/${MAX_RETRIES})`,
					{
						id: MESSAGE_QUEUE_RETRY_TOAST_ID,
						description: `Failed to send: "${firstMessage.query.slice(0, 50)}${firstMessage.query.length > 50 ? "..." : ""}"`,
					},
				);
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
			// Content dedup: reject an identical, non-empty message submitted
			// within DEDUP_WINDOW_MS (accidental double-click / double-Enter)
			// without appending or dispatching. Empty queries are already a
			// no-op downstream, so only the identical-non-empty case is blocked.
			const trimmedQuery = query.trim();
			const last = lastEnqueueRef.current;
			if (
				trimmedQuery.length > 0 &&
				last !== null &&
				last.query === trimmedQuery &&
				Date.now() - last.at < DEDUP_WINDOW_MS
			) {
				console.debug(
					"[MessageQueue] Dropped duplicate submit within dedup window:",
					trimmedQuery.slice(0, 50),
				);
				return false;
			}

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

			// Record this accepted enqueue for short-window dedup. Empty
			// queries are not tracked so a real message after a blank send is
			// never mistaken for a duplicate.
			if (trimmedQuery.length > 0) {
				lastEnqueueRef.current = { query: trimmedQuery, at: Date.now() };
			}

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
		if (
			wasEditing !== null &&
			editingId === null &&
			!isStreaming &&
			queueRef.current.length > 0
		) {
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
