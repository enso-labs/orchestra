import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	getThread,
	listThreadCheckpoints,
	getThreadCheckpoint,
	forkThreadCheckpoint,
} from "@/lib/services/threadService";
import apiClient from "@/lib/utils/apiClient";

vi.mock("../../lib/utils/apiClient", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
	},
}));

describe("threadService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches a thread record from the dedicated endpoint", async () => {
		(apiClient.get as any).mockResolvedValueOnce({
			data: { thread: { id: "thread-123", head_checkpoint_id: "cp-1" } },
		});

		const result = await getThread("thread-123");

		expect(apiClient.get).toHaveBeenCalledWith("/threads/thread-123");
		expect(result).toEqual({ id: "thread-123", head_checkpoint_id: "cp-1" });
	});

	it("lists checkpoint summaries from the checkpoint endpoint", async () => {
		(apiClient.get as any).mockResolvedValueOnce({
			data: { checkpoints: [{ checkpoint_id: "cp-1", is_head: true }] },
		});

		const result = await listThreadCheckpoints("thread-123", { limit: 10 });

		expect(apiClient.get).toHaveBeenCalledWith(
			"/threads/thread-123/checkpoints",
			{ params: { limit: 10 } },
		);
		expect(result).toEqual([{ checkpoint_id: "cp-1", is_head: true }]);
	});

	it("fetches checkpoint detail from the checkpoint endpoint", async () => {
		(apiClient.get as any).mockResolvedValueOnce({
			data: {
				checkpoint: {
					thread_id: "thread-123",
					checkpoint_id: "cp-9",
					messages: [],
					files: {},
					todos: [],
					metadata: {},
				},
			},
		});

		const result = await getThreadCheckpoint("thread-123", "cp-9");

		expect(apiClient.get).toHaveBeenCalledWith(
			"/threads/thread-123/checkpoints/cp-9",
		);
		expect(result.checkpoint_id).toBe("cp-9");
	});

	it("forks a checkpoint using the restore endpoint", async () => {
		(apiClient.post as any).mockResolvedValueOnce({
			data: {
				thread_id: "fork-123",
				head_checkpoint_id: "fork-cp-1",
				source_thread_id: "thread-123",
				source_checkpoint_id: "cp-9",
			},
		});

		const result = await forkThreadCheckpoint("thread-123", "cp-9", {
			title: "Forked thread",
		});

		expect(apiClient.post).toHaveBeenCalledWith(
			"/threads/thread-123/checkpoints/cp-9/fork",
			{ title: "Forked thread" },
		);
		expect(result.thread_id).toBe("fork-123");
	});
});
