import { useEffect, useState, useCallback, useRef } from "react";
import {
	searchThreads,
	getThread,
	listThreadCheckpoints,
	getThreadCheckpoint,
} from "@/lib/services/threadService";
import { formatMessages } from "@/lib/utils/format";
import { latestHumanMessage } from "@/lib/utils/message";
import type { Todo } from "@/components/lists/TodoList";
import type {
	ThreadCheckpointDetail,
	ThreadCheckpointSummary,
	ThreadRecord,
	ThreadViewMode,
} from "@/lib/entities";

const LIMIT = 20;

export type ThreadData = {
	thread: ThreadRecord;
	checkpoints: ThreadCheckpointSummary[];
	messages: any[];
	metadata: any;
	todos: Todo[];
	filesMap: Map<string, any>;
	model: string;
	threadViewMode: ThreadViewMode;
	activeCheckpointId: string | null;
	checkpointDetail: ThreadCheckpointDetail;
};

export type ThreadContextType = {
	threads: any[];
	setThreads: (threads: any[]) => void;
	checkpoints: ThreadCheckpointSummary[];
	setCheckpoints: (checkpoints: ThreadCheckpointSummary[]) => void;
	checkpoint: ThreadCheckpointDetail | null;
	setCheckpoint: (checkpoint: ThreadCheckpointDetail | null) => void;
	searchThreads: (
		action: "list_threads" | "list_checkpoints" | "get_checkpoint",
		metadata: { thread_id?: string; checkpoint_id?: string },
	) => void;
	useListThreadsEffect: (trigger?: boolean, filter?: any) => void;
	useListCheckpointsEffect: (trigger?: boolean, threadId?: string) => void;
	loadMoreThreads: (filter?: any) => Promise<void>;
	hasMoreThreads: boolean;
	isLoadingMoreThreads: boolean;
	loadThread: (
		threadId: string,
		checkpointId?: string,
	) => Promise<ThreadData | null>;
	loadLatestThread: (threadId: string) => Promise<ThreadData | null>;
	loadCheckpointPreview: (
		threadId: string,
		checkpointId: string,
	) => Promise<ThreadData | null>;
	threadLoading: boolean;
	threadError: string | null;
	checkpointsLoading: boolean;
	checkpointsError: string | null;
	threadViewMode: ThreadViewMode;
	setThreadViewMode: (mode: ThreadViewMode) => void;
	activeCheckpointId: string | null;
	setActiveCheckpointId: (checkpointId: string | null) => void;
	previewCheckpoint: ThreadCheckpointDetail | null;
	setPreviewCheckpoint: (checkpoint: ThreadCheckpointDetail | null) => void;
	currentThread: ThreadRecord | null;
	setCurrentThread: (thread: ThreadRecord | null) => void;
	useLoadThreadEffect: (
		threadId: string | undefined,
		callbacks: {
			setCheckpoints: (checkpoints: ThreadCheckpointSummary[]) => void;
			setMessages: (messages: any[]) => void;
			setMetadata: (metadata: any) => void;
			setFilesMap: (filesMap: Map<string, any>) => void;
			setTodos: (todos: Todo[]) => void;
			setModel: (model: string) => void;
		},
		options?: {
			enabled?: boolean;
			checkpointId?: string;
		},
	) => void;
};

const buildFilesMap = (
	checkpointDetail: ThreadCheckpointDetail,
	messages: any[],
): Map<string, any> => {
	const filesMap = new Map<string, any>();
	if (
		!checkpointDetail.files ||
		Object.keys(checkpointDetail.files).length === 0
	) {
		return filesMap;
	}

	const latestAiMessage = messages
		.slice()
		.reverse()
		.find((msg: any) => ["ai", "assistant"].includes(msg.role));

	filesMap.set(
		latestAiMessage?.id || checkpointDetail.checkpoint_id,
		checkpointDetail.files,
	);
	return filesMap;
};

export default function useThread(): ThreadContextType {
	const [threads, setThreads] = useState<any[]>([]);
	const [checkpoints, setCheckpoints] = useState<ThreadCheckpointSummary[]>([]);
	const [checkpoint, setCheckpoint] = useState<ThreadCheckpointDetail | null>(
		null,
	);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMoreThreads, setHasMoreThreads] = useState<boolean>(true);
	const [isLoadingMoreThreads, setIsLoadingMoreThreads] =
		useState<boolean>(false);
	const [threadLoading, setThreadLoading] = useState<boolean>(false);
	const [threadError, setThreadError] = useState<string | null>(null);
	const [checkpointsLoading, setCheckpointsLoading] = useState<boolean>(false);
	const [checkpointsError, setCheckpointsError] = useState<string | null>(null);
	const [threadViewMode, setThreadViewMode] =
		useState<ThreadViewMode>("latest");
	const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(
		null,
	);
	const [previewCheckpoint, setPreviewCheckpoint] =
		useState<ThreadCheckpointDetail | null>(null);
	const [currentThread, setCurrentThread] = useState<ThreadRecord | null>(null);

	const hydrateThread = useCallback(
		async (
			threadId: string,
			checkpointId?: string,
		): Promise<ThreadData | null> => {
			if (!threadId) return null;

			setThreadLoading(true);
			setThreadError(null);

			try {
				const thread = await getThread(threadId);
				const targetCheckpointId = checkpointId || thread.head_checkpoint_id;

				if (!targetCheckpointId) {
					setThreadError("No checkpoints found for thread");
					return null;
				}

				const checkpointDetail = await getThreadCheckpoint(
					threadId,
					targetCheckpointId,
				);
				const messages = formatMessages(checkpointDetail.messages);
				const todos: Todo[] = Array.isArray(checkpointDetail.todos)
					? checkpointDetail.todos
					: [];
				const metadata = {
					...thread,
					...checkpointDetail.metadata,
					thread_id: threadId,
					checkpoint_id: checkpointDetail.checkpoint_id,
					head_checkpoint_id: thread.head_checkpoint_id,
				};
				const resolvedViewMode: ThreadViewMode = checkpointId
					? "checkpoint_preview"
					: "latest";

				setCurrentThread(thread);
				setCheckpoint(checkpointDetail);
				setActiveCheckpointId(checkpointDetail.checkpoint_id);
				setThreadViewMode(resolvedViewMode);
				setPreviewCheckpoint(
					resolvedViewMode === "checkpoint_preview" ? checkpointDetail : null,
				);

				return {
					thread,
					checkpoints,
					messages,
					metadata,
					todos,
					filesMap: buildFilesMap(checkpointDetail, messages),
					model: latestHumanMessage(messages)?.model,
					threadViewMode: resolvedViewMode,
					activeCheckpointId: checkpointDetail.checkpoint_id,
					checkpointDetail,
				};
			} catch (err) {
				console.error("Failed to load thread:", err);
				setThreadError("Failed to load thread");
				return null;
			} finally {
				setThreadLoading(false);
			}
		},
		[checkpoints],
	);

	const loadLatestThread = useCallback(
		async (threadId: string): Promise<ThreadData | null> =>
			hydrateThread(threadId),
		[hydrateThread],
	);

	const loadCheckpointPreview = useCallback(
		async (
			threadId: string,
			checkpointId: string,
		): Promise<ThreadData | null> => hydrateThread(threadId, checkpointId),
		[hydrateThread],
	);

	const loadThread = useCallback(
		async (
			threadId: string,
			checkpointId?: string,
		): Promise<ThreadData | null> => {
			if (checkpointId) {
				return loadCheckpointPreview(threadId, checkpointId);
			}
			return loadLatestThread(threadId);
		},
		[loadCheckpointPreview, loadLatestThread],
	);

	const useLoadThreadEffect = (
		threadId: string | undefined,
		callbacks: {
			setCheckpoints: (checkpoints: ThreadCheckpointSummary[]) => void;
			setMessages: (messages: any[]) => void;
			setMetadata: (metadata: any) => void;
			setFilesMap: (filesMap: Map<string, any>) => void;
			setTodos: (todos: Todo[]) => void;
			setModel: (model: string) => void;
		},
		options: {
			enabled?: boolean;
			checkpointId?: string;
		} = {},
	) => {
		const enabled = options.enabled ?? true;
		const checkpointId = options.checkpointId;
		const callbacksRef = useRef(callbacks);

		useEffect(() => {
			callbacksRef.current = callbacks;
		}, [callbacks]);

		useEffect(() => {
			if (!enabled) {
				setThreadLoading(false);
				setThreadError(null);
				return;
			}

			let isActive = true;

			const fetchThread = async () => {
				if (!threadId) return;

				const data = await loadThread(threadId, checkpointId);
				if (!isActive || !data) {
					return;
				}

				callbacksRef.current.setCheckpoints(data.checkpoints);
				callbacksRef.current.setMessages(data.messages);
				callbacksRef.current.setMetadata(data.metadata);
				callbacksRef.current.setFilesMap(data.filesMap);
				callbacksRef.current.setTodos(data.todos);
				callbacksRef.current.setModel(data.model);
			};

			fetchThread();

			return () => {
				isActive = false;
			};
		}, [threadId, enabled, checkpointId, loadThread]);
	};

	const fetchThreads = async (
		action: "list_threads" | "list_checkpoints" | "get_checkpoint",
		filter: {
			thread_id?: string;
			checkpoint_id?: string;
			metadata?: { assistant_id?: string; project_id?: string };
		} = {},
	) => {
		const data = await searchThreads(action, filter, LIMIT, 0);

		if (action === "list_threads") {
			setThreads(data);
			if (data.length > 0) {
				const lastThread = data[data.length - 1];
				setCursor(lastThread.updated_at);
			}
			setHasMoreThreads(data.length === LIMIT);
		} else if (action === "list_checkpoints") {
			setCheckpoints(data);
		} else if (action === "get_checkpoint") {
			setCheckpoint(data);
		}
	};

	const loadMoreThreads = async (filter: any = {}) => {
		if (isLoadingMoreThreads || !hasMoreThreads) {
			return;
		}

		try {
			setIsLoadingMoreThreads(true);

			const paginationFilter = { ...filter };
			if (cursor) {
				paginationFilter.updated_at = { $lt: cursor };
			}

			const newThreads = await searchThreads(
				"list_threads",
				paginationFilter,
				LIMIT,
				0,
			);

			setThreads((prev) => [...prev, ...newThreads]);

			if (newThreads.length > 0) {
				const lastThread = newThreads[newThreads.length - 1];
				setCursor(lastThread.updated_at);
			}

			setHasMoreThreads(newThreads.length === LIMIT);
		} catch (error) {
			console.error("Error loading more threads:", error);
		} finally {
			setIsLoadingMoreThreads(false);
		}
	};

	const useListThreadsEffect = (
		trigger?: boolean,
		filter: { metadata?: { [key: string]: any } } = {},
	) => {
		useEffect(() => {
			if (trigger === false) return;
			setCursor(null);
			setHasMoreThreads(true);
			fetchThreads("list_threads", filter);
		}, [trigger]);
	};

	const useListCheckpointsEffect = (trigger?: boolean, threadId?: string) => {
		useEffect(() => {
			if (trigger === false || !threadId) {
				return;
			}

			let isActive = true;
			setCheckpointsLoading(true);
			setCheckpointsError(null);

			listThreadCheckpoints(threadId, { limit: LIMIT })
				.then((items) => {
					if (!isActive) return;
					setCheckpoints(items);
				})
				.catch((error) => {
					console.error("Failed to load checkpoints:", error);
					if (!isActive) return;
					setCheckpointsError("Failed to load checkpoints");
				})
				.finally(() => {
					if (!isActive) return;
					setCheckpointsLoading(false);
				});

			return () => {
				isActive = false;
			};
		}, [trigger, threadId]);
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
		loadLatestThread,
		loadCheckpointPreview,
		threadLoading,
		threadError,
		checkpointsLoading,
		checkpointsError,
		threadViewMode,
		setThreadViewMode,
		activeCheckpointId,
		setActiveCheckpointId,
		previewCheckpoint,
		setPreviewCheckpoint,
		currentThread,
		setCurrentThread,
		useLoadThreadEffect,
	};
}
