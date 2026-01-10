import { useState, useCallback, useMemo } from "react";

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
	renameFile: (oldPath: string, newPath: string) => void;

	// Tab operations (modify openTabs only)
	openTab: (path: string) => void;
	closeTab: (path: string) => void;
	selectTab: (path: string) => void;

	// Bulk operations
	importFiles: (files: Map<string, FileData>) => void;
	clearFileSystem: () => void;
	getFilesForSubmission: () => Record<string, FileData>;

	// Dirty tracking
	markDirty: (path: string) => void;
	markClean: (path: string) => void;
}

export type FileSystemHook = FileSystemState & FileSystemActions;

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
	const deleteFile = useCallback(
		(path: string) => {
			setFileSystem((prev) => {
				const next = new Map(prev);
				next.delete(path);
				return next;
			});

			// Remove from dirty files
			setDirtyFiles((prev) => {
				const next = new Set(prev);
				next.delete(path);
				return next;
			});

			// Remove from tabs and handle active file selection in one operation
			setOpenTabs((prev) => {
				const idx = prev.indexOf(path);
				const filtered = prev.filter((p) => p !== path);

				// If this was the active file, select adjacent
				if (activeFile === path) {
					const newActive = filtered[idx] || filtered[idx - 1] || null;
					setActiveFile(newActive);
				}

				return filtered;
			});
		},
		[activeFile],
	);

	/**
	 * Rename file (move to new path)
	 */
	const renameFile = useCallback(
		(oldPath: string, newPath: string) => {
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
			setOpenTabs((prev) =>
				prev.map((p) => (p === oldPath ? newPath : p)),
			);

			// Update active
			if (activeFile === oldPath) {
				setActiveFile(newPath);
			}

			// Update dirty tracking
			setDirtyFiles((prev) => {
				if (!prev.has(oldPath)) return prev;
				const next = new Set(prev);
				next.delete(oldPath);
				next.add(newPath);
				return next;
			});
		},
		[activeFile],
	);

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
	const closeTab = useCallback(
		(path: string) => {
			setOpenTabs((prev) => {
				const filtered = prev.filter((p) => p !== path);

				// If closing active tab, select adjacent
				if (activeFile === path) {
					const idx = prev.indexOf(path);
					const newActive = filtered[idx] || filtered[idx - 1] || null;
					setActiveFile(newActive);
				}

				return filtered;
			});

			// Clear dirty state for closed tab
			setDirtyFiles((prev) => {
				const next = new Set(prev);
				next.delete(path);
				return next;
			});
		},
		[activeFile],
	);

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
	 * Used when receiving files from SSE stream
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
			renameFile,
			// Tab operations
			openTab,
			closeTab,
			selectTab,
			// Bulk operations
			importFiles,
			clearFileSystem,
			getFilesForSubmission,
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
			renameFile,
			openTab,
			closeTab,
			selectTab,
			importFiles,
			clearFileSystem,
			getFilesForSubmission,
			markDirty,
			markClean,
		],
	);
}

export default useFileSystem;
