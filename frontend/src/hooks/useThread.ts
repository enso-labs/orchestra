import { useEffect, useState } from "react";
import { searchThreads } from "@/lib/services/threadService";

const LIMIT = 20;

export type ThreadContextType = {
	threads: any[];
	setThreads: (threads: any[]) => void;
	checkpoints: any[];
	setCheckpoints: (checkpoints: any[]) => void;
	checkpoint: any;
	setCheckpoint: (checkpoint: any) => void;
	searchThreads: (
		action: "list_threads" | "list_checkpoints" | "get_checkpoint",
		metadata: { thread_id?: string; checkpoint_id?: string },
	) => void;
	useListThreadsEffect: (trigger?: boolean) => void;
	useListCheckpointsEffect: (
		trigger?: boolean,
		metadata?: { thread_id?: string },
	) => void;
	loadMoreThreads: (filter?: any) => Promise<void>;
	hasMoreThreads: boolean;
	isLoadingMoreThreads: boolean;
};

export default function useThread(): ThreadContextType {
	const [threads, setThreads] = useState<any[]>([]);
	const [checkpoints, setCheckpoints] = useState<any[]>([]);
	const [checkpoint, setCheckpoint] = useState<any>(null);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMoreThreads, setHasMoreThreads] = useState<boolean>(true);
	const [isLoadingMoreThreads, setIsLoadingMoreThreads] = useState<boolean>(false);

	useEffect(() => {
		console.log(
			checkpoints?.filter(
				(checkpoint: any) => checkpoint.metadata.source === "input",
			),
		);
	}, [checkpoints]);

	const fetchThreads = async (
		action: "list_threads" | "list_checkpoints" | "get_checkpoint",
		filter: {
			thread_id?: string;
			checkpoint_id?: string;
			assistant_id?: string;
		} = {},
	) => {
		// Always pass limit and offset (defaults: 20, 0) to searchThreads
		const data = await searchThreads(action, filter, LIMIT, 0);

		if (action === "list_threads") {
			setThreads(data);
			// Extract cursor from last thread for pagination
			if (data.length > 0) {
				const lastThread = data[data.length - 1];
				setCursor(lastThread.updated_at);
			}
			// Set hasMore based on whether we got a full page
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

			// Build filter with cursor for pagination
			const paginationFilter = { ...filter };
			if (cursor) {
				// Use cursor-based pagination: fetch threads older than cursor
				paginationFilter.updated_at = { $lt: cursor };
			}

			// Fetch threads with limit (offset=0 since we use cursor-based pagination)
			const newThreads = await searchThreads("list_threads", paginationFilter, LIMIT, 0);

			setThreads((prev) => [...prev, ...newThreads]);

			// Extract cursor from last thread for next page
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
		filter: { assistant_id?: string } = {},
	) => {
		useEffect(() => {
			// Reset pagination state for fresh load
			setCursor(null);
			setHasMoreThreads(true);
			// Don't clear threads immediately - let fetchThreads replace them
			// This prevents breaking checkpoint fetching that may run concurrently
			fetchThreads("list_threads", filter);
		}, [trigger]);
	};

	const useListCheckpointsEffect = (
		trigger?: boolean,
		metadata: { thread_id?: string } = {},
	) => {
		useEffect(() => {
			fetchThreads("list_checkpoints", metadata);
		}, [trigger]);
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
	};
}
