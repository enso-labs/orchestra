import { SemanticThread, ThreadSearchRequest } from "@/lib/entities";
import { agentClient } from "@/lib/api/agentClient";

/** Read a thread through the sole Agent Protocol client. */
export const getThread = async (threadId: string) => {
	return agentClient.threads.get(threadId);
};

type ThreadAction = "list_threads" | "list_checkpoints" | "get_checkpoint";
type ThreadFilter = {
	thread_id?: string;
	checkpoint_id?: string;
	assistant_id?: string;
	project_id?: string | null;
	metadata?: Record<string, unknown>;
};

function protocolMetadata(filter: ThreadFilter): Record<string, unknown> {
	const metadata = {
		...(filter.metadata ?? {}),
		...Object.fromEntries(
			Object.entries(filter).filter(
				([key, value]) =>
					!["thread_id", "checkpoint_id", "metadata"].includes(key) &&
					value !== undefined,
			),
		),
	};
	if (filter.assistant_id) {
		metadata.orchestra_assistant_id = filter.assistant_id;
	}
	return metadata;
}

function toLegacyThread(thread: any): any {
	const values =
		thread?.values && typeof thread.values === "object" ? thread.values : {};
	const metadata =
		thread?.metadata && typeof thread.metadata === "object"
			? thread.metadata
			: {};
	return {
		...thread,
		key: thread.thread_id,
		value: {
			...values,
			...metadata,
			thread_id: thread.thread_id,
			assistant_id:
				metadata.orchestra_assistant_id ??
				metadata.assistant_id ??
				values.assistant_id,
			project_id: metadata.project_id ?? values.project_id,
		},
	};
}

/**
 * SDK-backed Protocol resource access. This preserves the old action-shaped
 * service API for callers while every graph/thread request uses SDK methods
 * and their documented HTTP verbs.
 */
export const searchThreads = async (
	action: ThreadAction,
	filter: ThreadFilter = {},
	limit = 20,
	offset = 0,
): Promise<any> => {
	if (action === "list_threads") {
		const threads = await agentClient.threads.search({
			limit,
			offset,
			metadata: protocolMetadata(filter),
			sortBy: "updated_at",
			sortOrder: "desc",
			select: [
				"thread_id",
				"created_at",
				"updated_at",
				"metadata",
				"values",
				"status",
			],
		});
		return threads.map(toLegacyThread);
	}

	if (!filter.thread_id) return [];
	if (action === "list_checkpoints") {
		return agentClient.threads.getHistory(filter.thread_id, { limit });
	}

	return agentClient.threads.getState(filter.thread_id, filter.checkpoint_id, {
		subgraphs: true,
	});
};

export const deleteThread = async (threadId: string) => {
	await agentClient.threads.delete(threadId);
	return true;
};

export const searchThreadsByProject = async (
	projectId: string,
	limit = 20,
	offset = 0,
) => {
	const threads = await agentClient.threads.search({
		limit,
		offset,
		metadata: { project_id: projectId },
		sortBy: "updated_at",
		sortOrder: "desc",
		select: [
			"thread_id",
			"created_at",
			"updated_at",
			"metadata",
			"values",
			"status",
		],
	});
	return threads.map(toLegacyThread);
};

export const updateThreadProject = async (
	threadId: string,
	projectId: string | null,
) => {
	const current = await agentClient.threads.get(threadId);
	return agentClient.threads.update(threadId, {
		metadata: { ...(current.metadata ?? {}), project_id: projectId },
	});
};

/**
 * Agent Protocol does not expose a text-search field. Fetch the SDK thread
 * page and perform the presentation-only text filter locally rather than
 * constructing a second transport or calling a legacy graph URL.
 */
export const searchThreadsSemantic = async (
	request: ThreadSearchRequest,
): Promise<{ threads: SemanticThread[] }> => {
	const threads = await agentClient.threads.search({
		limit: request.limit ?? 20,
		metadata: request.assistant_id
			? { orchestra_assistant_id: request.assistant_id }
			: undefined,
		select: ["thread_id", "updated_at", "metadata", "values"],
	});
	const query = request.query.toLowerCase();
	return {
		threads: threads
			.filter((thread) => {
				const values = (thread.values ?? {}) as Record<string, unknown>;
				return JSON.stringify(values).toLowerCase().includes(query);
			})
			.map((thread) => ({
				id: thread.thread_id,
				messages: ((thread.values as any)?.messages ?? []) as any[],
				files: ((thread.values as any)?.files ?? []) as any[],
				score: 1,
				updated_at: thread.updated_at ?? null,
			})),
	};
};

export type { ThreadFilter, ThreadAction };
