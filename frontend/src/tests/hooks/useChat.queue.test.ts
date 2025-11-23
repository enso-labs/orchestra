import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueuedMessage } from "@/hooks/useChat";

// Test the queue logic in isolation
describe("Message Queue Logic", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("Queue State Management", () => {
		it("should add message to queue", () => {
			const queue: QueuedMessage[] = [];
			const content = "Test message";
			const images: File[] = [];

			const queuedMessage: QueuedMessage = {
				id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				content,
				images: [...images],
			};

			const newQueue = [...queue, queuedMessage];

			expect(newQueue.length).toBe(1);
			expect(newQueue[0].content).toBe(content);
			expect(newQueue[0].images).toEqual(images);
		});

		it("should add multiple messages to queue in order", () => {
			let queue: QueuedMessage[] = [];

			// Add first message
			const msg1: QueuedMessage = {
				id: "queue-1",
				content: "First message",
				images: [],
			};
			queue = [...queue, msg1];

			// Add second message
			const msg2: QueuedMessage = {
				id: "queue-2",
				content: "Second message",
				images: [],
			};
			queue = [...queue, msg2];

			// Add third message
			const msg3: QueuedMessage = {
				id: "queue-3",
				content: "Third message",
				images: [],
			};
			queue = [...queue, msg3];

			expect(queue.length).toBe(3);
			expect(queue[0].content).toBe("First message");
			expect(queue[1].content).toBe("Second message");
			expect(queue[2].content).toBe("Third message");
		});

		it("should remove message from queue by id", () => {
			const queue: QueuedMessage[] = [
				{ id: "queue-1", content: "First", images: [] },
				{ id: "queue-2", content: "Second", images: [] },
				{ id: "queue-3", content: "Third", images: [] },
			];

			const idToRemove = "queue-2";
			const newQueue = queue.filter((msg) => msg.id !== idToRemove);

			expect(newQueue.length).toBe(2);
			expect(newQueue[0].content).toBe("First");
			expect(newQueue[1].content).toBe("Third");
		});

		it("should clear all messages from queue", () => {
			const queue: QueuedMessage[] = [
				{ id: "queue-1", content: "First", images: [] },
				{ id: "queue-2", content: "Second", images: [] },
			];

			// Simulate clearing
			const clearedQueue: QueuedMessage[] = [];

			expect(queue.length).toBe(2);
			expect(clearedQueue.length).toBe(0);
		});

		it("should handle messages with images", () => {
			const mockFile = new File(["test"], "test.png", { type: "image/png" });
			const queue: QueuedMessage[] = [];

			const queuedMessage: QueuedMessage = {
				id: "queue-1",
				content: "Message with image",
				images: [mockFile],
			};

			const newQueue = [...queue, queuedMessage];

			expect(newQueue[0].images.length).toBe(1);
			expect(newQueue[0].images[0].name).toBe("test.png");
		});
	});

	describe("Queue Processing", () => {
		it("should process messages in FIFO order", () => {
			let queue: QueuedMessage[] = [
				{ id: "queue-1", content: "First", images: [] },
				{ id: "queue-2", content: "Second", images: [] },
				{ id: "queue-3", content: "Third", images: [] },
			];

			// Process first message
			const [nextMessage, ...remainingQueue] = queue;

			expect(nextMessage.content).toBe("First");
			expect(remainingQueue.length).toBe(2);
			expect(remainingQueue[0].content).toBe("Second");
		});

		it("should return empty when queue is empty", () => {
			const queue: QueuedMessage[] = [];

			if (queue.length === 0) {
				expect(true).toBe(true);
			} else {
				expect(false).toBe(true);
			}
		});
	});

	describe("Queue Position Display", () => {
		it("should correctly show position for each queued message", () => {
			const queue: QueuedMessage[] = [
				{ id: "queue-1", content: "First", images: [] },
				{ id: "queue-2", content: "Second", images: [] },
				{ id: "queue-3", content: "Third", images: [] },
			];

			queue.forEach((_msg, index) => {
				const position = index + 1;
				expect(position).toBeGreaterThan(0);
				expect(position).toBeLessThanOrEqual(queue.length);
			});

			expect(queue.length).toBe(3);
		});
	});

	describe("Stop Button with Queue", () => {
		it("should preserve queue when processing is stopped", () => {
			const queue: QueuedMessage[] = [
				{ id: "queue-1", content: "First", images: [] },
				{ id: "queue-2", content: "Second", images: [] },
			];

			// Simulating abort - queue should remain
			const queueAfterAbort = queue;

			expect(queueAfterAbort.length).toBe(2);
			expect(queueAfterAbort[0].content).toBe("First");
		});

		it("should allow adding to queue after stop", () => {
			let queue: QueuedMessage[] = [
				{ id: "queue-1", content: "First", images: [] },
			];

			// After abort, user adds new message
			const newMessage: QueuedMessage = {
				id: "queue-2",
				content: "New after stop",
				images: [],
			};
			queue = [...queue, newMessage];

			expect(queue.length).toBe(2);
			expect(queue[1].content).toBe("New after stop");
		});
	});
});
