import { useState, useCallback, useEffect, useRef } from "react";
import { searchThreadsByProject } from "@/lib/services/threadService";

const THREADS_PER_PAGE = 5;
const STORAGE_KEY = "orchestra:sidebar:expanded_projects";

interface ProjectThreadsState {
	threads: any[];
	loading: boolean;
	hasMore: boolean;
	offset: number;
	loaded: boolean;
}

function getInitialExpandedProjects(): Set<string> {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return new Set(JSON.parse(stored));
		}
	} catch {
		// ignore
	}
	return new Set();
}

function persistExpandedProjects(expanded: Set<string>) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]));
	} catch {
		// ignore
	}
}

export function useProjectThreads() {
	const [projectThreadsMap, setProjectThreadsMap] = useState<
		Map<string, ProjectThreadsState>
	>(new Map());
	const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
		getInitialExpandedProjects,
	);
	// Refs for synchronous guards — setState updaters may be deferred in React 18
	const inflightRef = useRef<Set<string>>(new Set());
	const loadedRef = useRef<Set<string>>(new Set());

	// Persist expanded state via useEffect
	useEffect(() => {
		persistExpandedProjects(expandedProjects);
	}, [expandedProjects]);

	const fetchProjectThreads = useCallback(
		async (projectId: string, reset = false) => {
			// Synchronous guards using refs (not setState side-effects)
			if (inflightRef.current.has(projectId) && !reset) return;
			if (loadedRef.current.has(projectId) && !reset) return;

			inflightRef.current.add(projectId);

			// Set loading state
			setProjectThreadsMap((prev) => {
				const next = new Map(prev);
				const current = prev.get(projectId);
				next.set(projectId, {
					threads: current?.threads || [],
					loading: true,
					hasMore: false,
					offset: 0,
					loaded: false,
				});
				return next;
			});

			try {
				const threads = await searchThreadsByProject(
					projectId,
					THREADS_PER_PAGE,
					0,
				);
				loadedRef.current.add(projectId);
				setProjectThreadsMap((prev) => {
					const next = new Map(prev);
					next.set(projectId, {
						threads,
						loading: false,
						hasMore: threads.length >= THREADS_PER_PAGE,
						offset: threads.length,
						loaded: true,
					});
					return next;
				});
			} catch {
				loadedRef.current.add(projectId);
				setProjectThreadsMap((prev) => {
					const next = new Map(prev);
					next.set(projectId, {
						threads: [],
						loading: false,
						hasMore: false,
						offset: 0,
						loaded: true,
					});
					return next;
				});
			} finally {
				inflightRef.current.delete(projectId);
			}
		},
		[],
	);

	const loadMoreProjectThreads = useCallback(async (projectId: string) => {
		if (inflightRef.current.has(`more:${projectId}`)) return;
		inflightRef.current.add(`more:${projectId}`);

		// Read current offset from state synchronously via a snapshot ref
		let currentOffset = 0;
		let canLoad = false;
		setProjectThreadsMap((prev) => {
			const state = prev.get(projectId);
			if (!state || state.loading || !state.hasMore) return prev;
			canLoad = true;
			currentOffset = state.offset;
			const next = new Map(prev);
			next.set(projectId, { ...state, loading: true });
			return next;
		});

		// For loadMore, the updater runs during setState, but if it doesn't,
		// we fall back to reading from the map directly
		if (!canLoad) {
			inflightRef.current.delete(`more:${projectId}`);
			return;
		}

		try {
			const newThreads = await searchThreadsByProject(
				projectId,
				THREADS_PER_PAGE,
				currentOffset,
			);
			setProjectThreadsMap((prev) => {
				const next = new Map(prev);
				const state = prev.get(projectId)!;
				const merged = [...state.threads, ...newThreads];
				next.set(projectId, {
					threads: merged,
					loading: false,
					hasMore: newThreads.length >= THREADS_PER_PAGE,
					offset: merged.length,
					loaded: true,
				});
				return next;
			});
		} catch {
			setProjectThreadsMap((prev) => {
				const next = new Map(prev);
				const state = prev.get(projectId)!;
				next.set(projectId, { ...state, loading: false });
				return next;
			});
		} finally {
			inflightRef.current.delete(`more:${projectId}`);
		}
	}, []);

	const addThreadToProject = useCallback((thread: any, projectId: string) => {
		setProjectThreadsMap((prev) => {
			const next = new Map(prev);
			const state = prev.get(projectId);
			if (state) {
				next.set(projectId, {
					...state,
					threads: [thread, ...state.threads],
				});
			} else {
				// Project not yet loaded — seed it so the thread appears immediately
				next.set(projectId, {
					threads: [thread],
					loading: false,
					hasMore: false,
					offset: 1,
					loaded: true,
				});
			}
			return next;
		});
	}, []);

	const removeThreadFromProject = useCallback(
		(threadKey: string, projectId: string) => {
			setProjectThreadsMap((prev) => {
				const next = new Map(prev);
				const state = prev.get(projectId);
				if (state) {
					next.set(projectId, {
						...state,
						threads: state.threads.filter((t: any) => t.key !== threadKey),
					});
				}
				return next;
			});
		},
		[],
	);

	const toggleProjectExpanded = useCallback((projectId: string) => {
		setExpandedProjects((prev) => {
			const next = new Set(prev);
			if (next.has(projectId)) {
				next.delete(projectId);
			} else {
				next.add(projectId);
			}
			return next;
		});
	}, []);

	const isProjectExpanded = useCallback(
		(projectId: string) => expandedProjects.has(projectId),
		[expandedProjects],
	);

	const invalidateProject = useCallback(
		(projectId: string) => {
			loadedRef.current.delete(projectId);
			fetchProjectThreads(projectId, true);
		},
		[fetchProjectThreads],
	);

	return {
		projectThreadsMap,
		fetchProjectThreads,
		loadMoreProjectThreads,
		addThreadToProject,
		removeThreadFromProject,
		toggleProjectExpanded,
		isProjectExpanded,
		invalidateProject,
		expandedProjects,
	};
}
