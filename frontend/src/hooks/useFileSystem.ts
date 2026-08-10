import { useState, useCallback, useMemo, useRef } from "react";

/**
 * File data structure stored in the file system
 */
export interface FileData {
	content: string[];
	created_at: string;
	modified_at: string;
	source?: string; // message ID that generated this file
}

/**
 * FileSystem state type
 */
export interface FileSystemState {
	fileSystem: Map<string, FileData>;
	openTabs: string[];
	activeFile: string | null;
	dirtyFiles: Set<string>;
}

/**
 * FileSystem actions type
 */
export interface FileSystemActions {
	// File operations (modify fileSystem)
	createFile: (path: string, content?: string) => void;
	updateFile: (path: string, content: string) => void;
	deleteFile: (path: string) => void;
	deleteFiles: (paths: string[]) => void;
	renameFile: (oldPath: string, newPath: string) => void;

	// Tab operations (modify openTabs only)
	openTab: (path: string) => void;
	closeTab: (path: string) => void;
	selectTab: (path: string) => void;

	// Bulk operations
	importFiles: (files: Map<string, FileData>) => void;
	replaceFiles: (files: Map<string, FileData>) => void;
	syncFiles: (
		files: Map<string, FileData>,
		options?: {
			openNewTabs?: boolean;
			resetDirtyFiles?: boolean;
		},
	) => void;
	clearFileSystem: () => void;
	getFilesForSubmission: () => Record<string, FileData>;

	// Backend sync operations
	toBackendFormat: () => Record<string, string>;
	fromBackendFormat: (data: Record<string, string>) => void;

	// Dirty tracking
	markDirty: (path: string) => void;
	markClean: (path: string) => void;
}

export type FileSystemHook = FileSystemState & FileSystemActions;

const getAdjacentTabAfterRemoval = (
	previousTabs: string[],
	remainingTabs: string[],
	removedPath: string,
): string | null => {
	const removedIndex = previousTabs.indexOf(removedPath);
	if (removedIndex === -1) {
		return remainingTabs[0] || null;
	}

	const survivingTabsBeforeRemoved = previousTabs
		.slice(0, removedIndex)
		.filter((path) => remainingTabs.includes(path)).length;

	return (
		remainingTabs[survivingTabsBeforeRemoved] ||
		remainingTabs[survivingTabsBeforeRemoved - 1] ||
		null
	);
};

/**
 * Custom hook for managing file system state with VSCode-like tab semantics.
 *
 * Key semantics:
 * - `fileSystem`: Canonical source of all files (path → data)
 * - `openTabs`: Ordered list of open tab paths (subset of fileSystem keys)
 * - `activeFile`: Currently selected tab (must be in openTabs)
 * - `dirtyFiles`: Files with unsaved changes
 *
 * Critical behavior:
 * - `closeTab()` removes from openTabs but KEEPS file in fileSystem
 * - `deleteFile()` removes from BOTH fileSystem and openTabs
 */
export function useFileSystem(): FileSystemHook {
	const [fileSystem, setFileSystem] = useState<Map<string, FileData>>(
		() => new Map(),
	);
	const [openTabs, setOpenTabs] = useState<string[]>([]);
	const [activeFile, setActiveFile] = useState<string | null>(null);
	const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(() => new Set());
	const fileSystemRef = useRef(fileSystem);
	const openTabsRef = useRef(openTabs);
	const activeFileRef = useRef(activeFile);
	const dirtyFilesRef = useRef(dirtyFiles);

	fileSystemRef.current = fileSystem;
	openTabsRef.current = openTabs;
	activeFileRef.current = activeFile;
	dirtyFilesRef.current = dirtyFiles;

	// =========================================================================
	// File Operations (modify fileSystem)
	// =========================================================================

	/**
	 * Create a new file and auto-open as tab
	 */
	const createFile = useCallback((path: string, content: string = "") => {
		const now = new Date().toISOString();
		const fileData: FileData = {
			content: content.split("\n"),
			created_at: now,
			modified_at: now,
			source: "__user_files__", // Mark as user-created for filesMap sync
		};

		setFileSystem((prev) => {
			const next = new Map(prev);
			next.set(path, fileData);
			return next;
		});

		// Auto-open as tab
		setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
		setActiveFile(path);
	}, []);

	/**
	 * Update file content
	 */
	const updateFile = useCallback((path: string, content: string) => {
		setFileSystem((prev) => {
			const existing = prev.get(path);
			if (!existing) return prev;

			const next = new Map(prev);
			next.set(path, {
				...existing,
				content: content.split("\n"),
				modified_at: new Date().toISOString(),
			});
			return next;
		});
	}, []);

	/**
	 * Delete file from fileSystem AND close any open tabs
	 */
	const deleteFiles = useCallback((paths: string[]) => {
		const uniquePaths = Array.from(new Set(paths)).filter(Boolean);
		if (uniquePaths.length === 0) {
			return;
		}

		const pathsToRemove = new Set(uniquePaths);

		setFileSystem((prev) => {
			let changed = false;
			const next = new Map(prev);
			uniquePaths.forEach((path) => {
				changed = next.delete(path) || changed;
			});
			return changed ? next : prev;
		});

		setDirtyFiles((prev) => {
			let changed = false;
			const next = new Set(prev);
			uniquePaths.forEach((path) => {
				changed = next.delete(path) || changed;
			});
			return changed ? next : prev;
		});

		setOpenTabs((prev) => {
			const filtered = prev.filter((path) => !pathsToRemove.has(path));
			if (filtered.length === prev.length) {
				return prev;
			}

			setActiveFile((currentActive) => {
				if (!currentActive || !pathsToRemove.has(currentActive)) {
					return currentActive;
				}

				return getAdjacentTabAfterRemoval(prev, filtered, currentActive);
			});

			return filtered;
		});
	}, []);

	const deleteFile = useCallback(
		(path: string) => {
			deleteFiles([path]);
		},
		[deleteFiles],
	);

	/**
	 * Rename file (move to new path)
	 */
	const renameFile = useCallback((oldPath: string, newPath: string) => {
		setFileSystem((prev) => {
			const existing = prev.get(oldPath);
			if (!existing) return prev;

			const next = new Map(prev);
			next.delete(oldPath);
			next.set(newPath, {
				...existing,
				modified_at: new Date().toISOString(),
			});
			return next;
		});

		// Update tabs
		setOpenTabs((prev) => prev.map((p) => (p === oldPath ? newPath : p)));
		setActiveFile((currentActive) =>
			currentActive === oldPath ? newPath : currentActive,
		);

		// Update dirty tracking
		setDirtyFiles((prev) => {
			if (!prev.has(oldPath)) return prev;
			const next = new Set(prev);
			next.delete(oldPath);
			next.add(newPath);
			return next;
		});
	}, []);

	// =========================================================================
	// Tab Operations (modify openTabs only - DO NOT delete files)
	// =========================================================================

	/**
	 * Open a file as a tab (does not create file)
	 */
	const openTab = useCallback((path: string) => {
		setOpenTabs((prev) => {
			if (prev.includes(path)) return prev;
			return [...prev, path];
		});
	}, []);

	/**
	 * Close a tab WITHOUT deleting the file
	 * This is the key VSCode behavior: closing a tab keeps the file
	 */
	const closeTab = useCallback((path: string) => {
		setOpenTabs((prev) => {
			if (!prev.includes(path)) {
				return prev;
			}

			const filtered = prev.filter((currentPath) => currentPath !== path);
			setActiveFile((currentActive) => {
				if (currentActive !== path) {
					return currentActive;
				}

				return getAdjacentTabAfterRemoval(prev, filtered, path);
			});

			return filtered;
		});

		// Clear dirty state for closed tab
		setDirtyFiles((prev) => {
			const next = new Set(prev);
			next.delete(path);
			return next;
		});
	}, []);

	/**
	 * Select a tab as active
	 */
	const selectTab = useCallback((path: string) => {
		setActiveFile(path);
		// Ensure it's in openTabs
		setOpenTabs((prev) => {
			if (prev.includes(path)) return prev;
			return [...prev, path];
		});
	}, []);

	// =========================================================================
	// Bulk Operations
	// =========================================================================

	/**
	 * Import multiple files (merge with existing)
	 * Used when receiving files from an SDK graph-run event
	 */
	const importFiles = useCallback((files: Map<string, FileData>) => {
		if (!files || files.size === 0) return;

		setFileSystem((prev) => {
			const next = new Map(prev);
			for (const [path, data] of files) {
				next.set(path, data);
			}
			return next;
		});

		// Auto-open all imported files as tabs
		const paths = Array.from(files.keys());
		setOpenTabs((prev) => {
			const newTabs = paths.filter((p) => !prev.includes(p));
			return [...prev, ...newTabs];
		});

		// Set first imported file as active if nothing selected
		setActiveFile((prev) => prev || paths[0] || null);
	}, []);

	const syncFiles = useCallback(
		(
			files: Map<string, FileData>,
			options: {
				openNewTabs?: boolean;
				resetDirtyFiles?: boolean;
			} = {},
		) => {
			const nextFiles = files ? new Map(files) : new Map<string, FileData>();
			const { openNewTabs = true, resetDirtyFiles = false } = options;
			const nextPaths = Array.from(nextFiles.keys());

			const preservedTabs = openTabsRef.current.filter((path) =>
				nextFiles.has(path),
			);
			const nextOpenTabs = [...preservedTabs];

			if (openNewTabs) {
				for (const path of nextPaths) {
					if (!nextOpenTabs.includes(path)) {
						nextOpenTabs.push(path);
					}
				}
			}

			const currentActive = activeFileRef.current;
			const nextActive =
				currentActive && nextFiles.has(currentActive)
					? currentActive
					: nextOpenTabs[0] || null;

			const nextDirtyFiles = resetDirtyFiles
				? new Set<string>()
				: new Set(
						Array.from(dirtyFilesRef.current).filter((path) =>
							nextFiles.has(path),
						),
					);

			setFileSystem(nextFiles);
			setOpenTabs(nextOpenTabs);
			setActiveFile(nextActive);
			setDirtyFiles(nextDirtyFiles);
		},
		[],
	);

	/**
	 * Replace the entire file system with a new set of files.
	 */
	const replaceFiles = useCallback(
		(files: Map<string, FileData>) => {
			syncFiles(files, {
				openNewTabs: true,
				resetDirtyFiles: true,
			});
		},
		[syncFiles],
	);

	/**
	 * Clear all file system state
	 */
	const clearFileSystem = useCallback(() => {
		setFileSystem(new Map());
		setOpenTabs([]);
		setActiveFile(null);
		setDirtyFiles(new Set());
	}, []);

	/**
	 * Get files in submission format for API calls
	 */
	const getFilesForSubmission = useCallback((): Record<string, FileData> => {
		const result: Record<string, FileData> = {};
		for (const [path, data] of fileSystem) {
			result[path] = data;
		}
		return result;
	}, [fileSystem]);

	/**
	 * Convert frontend format to backend format (Dict[str, str])
	 * Joins content lines back into a single string
	 */
	const toBackendFormat = useCallback((): Record<string, string> => {
		const result: Record<string, string> = {};
		for (const [path, data] of fileSystem) {
			result[path] = data.content.join("\n");
		}
		return result;
	}, [fileSystem]);

	/**
	 * Import from backend format (Dict[str, str])
	 * Converts string content to array of lines and creates FileData entries
	 */
	const fromBackendFormat = useCallback((data: Record<string, string>) => {
		if (!data || Object.keys(data).length === 0) return;

		const now = new Date().toISOString();
		setFileSystem((prev) => {
			const next = new Map(prev);
			for (const [path, content] of Object.entries(data)) {
				next.set(path, {
					content: content.split("\n"),
					created_at: now,
					modified_at: now,
					source: "__backend_sync__",
				});
			}
			return next;
		});

		// Auto-open all imported files as tabs
		const paths = Object.keys(data);
		setOpenTabs((prev) => {
			const newTabs = paths.filter((p) => !prev.includes(p));
			return [...prev, ...newTabs];
		});

		// Set first imported file as active if nothing selected
		setActiveFile((prev) => prev || paths[0] || null);
	}, []);

	// =========================================================================
	// Dirty Tracking
	// =========================================================================

	const markDirty = useCallback((path: string) => {
		setDirtyFiles((prev) => {
			const next = new Set(prev);
			next.add(path);
			return next;
		});
	}, []);

	const markClean = useCallback((path: string) => {
		setDirtyFiles((prev) => {
			const next = new Set(prev);
			next.delete(path);
			return next;
		});
	}, []);

	// =========================================================================
	// Return
	// =========================================================================

	return useMemo(
		() => ({
			// State
			fileSystem,
			openTabs,
			activeFile,
			dirtyFiles,
			// File operations
			createFile,
			updateFile,
			deleteFile,
			deleteFiles,
			renameFile,
			// Tab operations
			openTab,
			closeTab,
			selectTab,
			// Bulk operations
			importFiles,
			replaceFiles,
			syncFiles,
			clearFileSystem,
			getFilesForSubmission,
			// Backend sync
			toBackendFormat,
			fromBackendFormat,
			// Dirty tracking
			markDirty,
			markClean,
		}),
		[
			fileSystem,
			openTabs,
			activeFile,
			dirtyFiles,
			createFile,
			updateFile,
			deleteFile,
			deleteFiles,
			renameFile,
			openTab,
			closeTab,
			selectTab,
			importFiles,
			replaceFiles,
			syncFiles,
			clearFileSystem,
			getFilesForSubmission,
			toBackendFormat,
			fromBackendFormat,
			markDirty,
			markClean,
		],
	);
}

export default useFileSystem;
