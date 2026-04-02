import { useState, useCallback } from "react";
import { searchThreadsByProject } from "@/lib/services/threadService";

const THREADS_PER_PAGE = 5;
const STORAGE_KEY = "sidebar_expanded_projects";

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

	const fetchProjectThreads = useCallback(
		async (projectId: string, reset = false) => {
			setProjectThreadsMap((prev) => {
				const current = prev.get(projectId);
				if (current?.loaded && !reset) return prev;
				const next = new Map(prev);
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
			}
		},
		[],
	);

	const loadMoreProjectThreads = useCallback(
		async (projectId: string) => {
			const current = projectThreadsMap.get(projectId);
			if (!current || current.loading || !current.hasMore) return;

			setProjectThreadsMap((prev) => {
				const next = new Map(prev);
				const state = prev.get(projectId)!;
				next.set(projectId, { ...state, loading: true });
				return next;
			});

			try {
				const newThreads = await searchThreadsByProject(
					projectId,
					THREADS_PER_PAGE,
					current.offset,
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
			}
		},
		[projectThreadsMap],
	);

	const addThreadToProject = useCallback((thread: any, projectId: string) => {
		setProjectThreadsMap((prev) => {
			const next = new Map(prev);
			const state = prev.get(projectId);
			if (state) {
				next.set(projectId, {
					...state,
					threads: [thread, ...state.threads],
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
			persistExpandedProjects(next);
			return next;
		});
	}, []);

	const isProjectExpanded = useCallback(
		(projectId: string) => expandedProjects.has(projectId),
		[expandedProjects],
	);

	const invalidateProject = useCallback(
		(projectId: string) => {
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
