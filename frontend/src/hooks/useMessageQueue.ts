import { useRef, useState } from "react";

export interface QueuedMessage {
	id: string;
	content: string;
	images: File[];
}

export const useMessageQueue = () => {
	const messageQueueRef = useRef<QueuedMessage[]>([]);
	const controllerRef = useRef<AbortController | null>(null);
	const [controller, setController] = useState<AbortController | null>(null);
	const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);

	const addToQueue = (content: string, images: File[]) => {
		const queuedMessage: QueuedMessage = {
			id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			content,
			images: [...images],
		};
		const newQueue = [...messageQueueRef.current, queuedMessage];
		messageQueueRef.current = newQueue;
		setMessageQueue(newQueue);
	};

	const removeFromQueue = (id: string) => {
		const newQueue = messageQueueRef.current.filter((msg) => msg.id !== id);
		messageQueueRef.current = newQueue;
		setMessageQueue(newQueue);
	};

	const clearQueue = () => {
		messageQueueRef.current = [];
		setMessageQueue([]);
	};

	const abortQuery = () => {
		if (controllerRef.current) {
			controllerRef.current.abort();
			controllerRef.current = null;
			setController(null);
		}
	};

	const nextQueueMessage = () => {
		const currentQueue = messageQueueRef.current;

		const [nextMessage, ...remainingQueue] = currentQueue;
		messageQueueRef.current = remainingQueue;
		setMessageQueue(remainingQueue);

	
		return nextMessage;
	};

	const resetController = () => {
		controllerRef.current = null;
		setController(null);
	};

	const resetQueue = () => {
		messageQueueRef.current = [];
		setMessageQueue([]);
	};

	return {
		controllerRef,
		messageQueue,
		addToQueue,
		removeFromQueue,
		clearQueue,
		abortQuery,
		controller,
		setController,
		nextQueueMessage,
		resetController,
		resetQueue,
	};
}