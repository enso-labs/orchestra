import { useCallback, useEffect, useRef, useState } from "react";
import { agentClient } from "@/lib/api/agentClient";
import { formatMessages } from "@/lib/utils/format";
import { latestHumanMessage } from "@/lib/utils/message";
import type { Todo } from "@/components/lists/TodoList";

const LIMIT = 20;
const HISTORY_LIMIT = 100;

type ThreadFilter = {
	thread_id?: string;
	checkpoint_id?: string;
	assistant_id?: string;
	project_id?: string | null;
	metadata?: Record<string, unknown>;
};

export type ThreadData = {
	checkpoints: any[];
	messages: any[];
	metadata: any;
	todos: Todo[];
	filesMap: Map<string, any>;
	model: string;
};

export type ThreadContextType = {
	threads: any[];
	setThreads: (threads: any[]) => void;
	checkpoints: any[];
	setCheckpoints: (checkpoints: any[]) => void;
	checkpoint: any;
	setCheckpoint: (checkpoint: any) => void;
	searchThreads: (
		action: "list_threads" | "list_checkpoints" | "get_checkpoint",
		filter: ThreadFilter,
	) => Promise<any>;
	useListThreadsEffect: (trigger?: boolean, filter?: ThreadFilter) => void;
	useListCheckpointsEffect: (
		trigger?: boolean,
		metadata?: { thread_id?: string },
	) => void;
	loadMoreThreads: (filter?: ThreadFilter) => Promise<void>;
	hasMoreThreads: boolean;
	isLoadingMoreThreads: boolean;
	loadThread: (threadId: string) => Promise<ThreadData | null>;
	threadLoading: boolean;
	threadError: string | null;
	useLoadThreadEffect: (
		threadId: string | undefined,
		callbacks: {
			setCheckpoints: (checkpoints: any[]) => void;
			setMessages: (messages: any[]) => void;
			setMetadata: (metadata: any) => void;
			setFilesMap: (filesMap: Map<string, any>) => void;
			setTodos: (todos: Todo[]) => void;
			setModel: (model: string) => void;
		},
		options?: { enabled?: boolean },
	) => void;
};

function assistantMetadata(filter: ThreadFilter): Record<string, unknown> {
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

function normalizeThread(thread: any): any {
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

export default function useThread(): ThreadContextType {
	const [threads, setThreads] = useState<any[]>([]);
	const [checkpoints, setCheckpoints] = useState<any[]>([]);
	const [checkpoint, setCheckpoint] = useState<any>(null);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMoreThreads, setHasMoreThreads] = useState(true);
	const [isLoadingMoreThreads, setIsLoadingMoreThreads] = useState(false);
	const [threadLoading, setThreadLoading] = useState(false);
	const [threadError, setThreadError] = useState<string | null>(null);

	const loadThread = useCallback(
		async (threadId: string): Promise<ThreadData | null> => {
			if (!threadId) return null;
			setThreadLoading(true);
			setThreadError(null);
			try {
				const history = await agentClient.threads.getHistory(threadId, {
					limit: HISTORY_LIMIT,
				});
				if (!history || history.length === 0) {
					setThreadError("No checkpoints found for thread");
					return null;
				}

				const latest = history[0];
				const values = (
					latest.values && typeof latest.values === "object"
						? latest.values
						: {}
				) as Record<string, any>;
				const stateMetadata =
					latest.metadata && typeof latest.metadata === "object"
						? latest.metadata
						: {};
				const threadMetadata = { ...stateMetadata, thread_id: threadId };
				const threadFiles =
					values.files && typeof values.files === "object"
						? values.files
						: stateMetadata.files && typeof stateMetadata.files === "object"
							? stateMetadata.files
							: {};
				const threadTodos = Array.isArray(values.todos)
					? values.todos
					: Array.isArray(stateMetadata.todos)
						? stateMetadata.todos
						: [];
				const filesMap = new Map<string, any>();
				if (Object.keys(threadFiles).length > 0)
					filesMap.set("thread", threadFiles);
				const messages = formatMessages(
					Array.isArray(values.messages) ? values.messages : [],
				);

				return {
					checkpoints: history,
					messages,
					metadata: threadMetadata,
					todos: threadTodos,
					filesMap,
					model: latestHumanMessage(messages)?.model,
				};
			} catch (error) {
				const status = (error as { status?: number })?.status;
				setThreadError(
					status === 401 || status === 403
						? "You do not have access to this thread"
						: "Failed to load thread",
				);
				return null;
			} finally {
				setThreadLoading(false);
			}
		},
		[],
	);

	const useLoadThreadEffect = (
		threadId: string | undefined,
		callbacks: {
			setCheckpoints: (checkpoints: any[]) => void;
			setMessages: (messages: any[]) => void;
			setMetadata: (metadata: any) => void;
			setFilesMap: (filesMap: Map<string, any>) => void;
			setTodos: (todos: Todo[]) => void;
			setModel: (model: string) => void;
		},
		options: { enabled?: boolean } = {},
	) => {
		const enabled = options.enabled ?? true;
		const callbacksRef = useRef(callbacks);
		callbacksRef.current = callbacks;
		useEffect(() => {
			if (!enabled) {
				setThreadLoading(false);
				setThreadError(null);
				return;
			}
			let isActive = true;
			if (threadId) {
				setThreadLoading(true);
				setThreadError(null);
			}

			void (async () => {
				if (!threadId) return;
				const data = await loadThread(threadId);
				if (!isActive || !data) return;
				callbacksRef.current.setCheckpoints(data.checkpoints);
				callbacksRef.current.setMessages(data.messages);
				callbacksRef.current.setMetadata(data.metadata);
				callbacksRef.current.setFilesMap(data.filesMap);
				callbacksRef.current.setTodos(data.todos);
				callbacksRef.current.setModel(data.model);
			})();

			return () => {
				isActive = false;
			};
		}, [enabled, loadThread, threadId]);
	};

	const fetchThreads = useCallback(
		async (
			action: "list_threads" | "list_checkpoints" | "get_checkpoint",
			filter: ThreadFilter = {},
			limit = LIMIT,
			offset = 0,
		) => {
			if (action === "list_threads") {
				const data = await agentClient.threads.search({
					limit,
					offset,
					metadata: assistantMetadata(filter),
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
				const normalized = data.map(normalizeThread);
				setThreads(normalized);
				const last = data[data.length - 1];
				setCursor(last?.updated_at ?? null);
				setHasMoreThreads(data.length === LIMIT);
				return normalized;
			}
			if (!filter.thread_id) return [];
			if (action === "list_checkpoints") {
				const data = await agentClient.threads.getHistory(filter.thread_id, {
					limit,
				});
				setCheckpoints(data);
				return data;
			}
			const data = await agentClient.threads.getState(
				filter.thread_id,
				filter.checkpoint_id,
				{ subgraphs: true },
			);
			setCheckpoint(data);
			return data;
		},
		[],
	);

	const searchThreads = useCallback(
		(
			action: "list_threads" | "list_checkpoints" | "get_checkpoint",
			filter: ThreadFilter,
		) => fetchThreads(action, filter),
		[fetchThreads],
	);

	const loadMoreThreads = useCallback(
		async (filter: ThreadFilter = {}) => {
			if (isLoadingMoreThreads || !hasMoreThreads) return;
			setIsLoadingMoreThreads(true);
			try {
				const data = await agentClient.threads.search({
					limit: LIMIT,
					offset: threads.length,
					metadata: assistantMetadata(filter),
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
				setThreads((previous) => [...previous, ...data.map(normalizeThread)]);
				const last = data[data.length - 1];
				setCursor(last?.updated_at ?? cursor);
				setHasMoreThreads(data.length === LIMIT);
			} catch {
				// The initial list remains visible; callers can retry pagination.
			} finally {
				setIsLoadingMoreThreads(false);
			}
		},
		[cursor, hasMoreThreads, isLoadingMoreThreads, threads.length],
	);

	const useListThreadsEffect = (
		trigger?: boolean,
		filter: ThreadFilter = {},
	) => {
		const filterRef = useRef(filter);
		filterRef.current = filter;
		useEffect(() => {
			setCursor(null);
			setHasMoreThreads(true);
			void fetchThreads("list_threads", filterRef.current);
		}, [fetchThreads, trigger]);
	};

	const useListCheckpointsEffect = (
		trigger?: boolean,
		metadata: { thread_id?: string } = {},
	) => {
		const metadataRef = useRef(metadata);
		metadataRef.current = metadata;
		useEffect(() => {
			void fetchThreads("list_checkpoints", metadataRef.current);
		}, [fetchThreads, trigger]);
	};

	return {
		threads,
		setThreads,
		checkpoints,
		setCheckpoints,
		checkpoint,
		setCheckpoint,
		searchThreads,
		useListThreadsEffect,
		useListCheckpointsEffect,
		loadMoreThreads,
		hasMoreThreads,
		isLoadingMoreThreads,
		loadThread,
		threadLoading,
		threadError,
		useLoadThreadEffect,
	};
}
