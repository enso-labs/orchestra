import {
	createContext,
	useContext,
	useState,
	useCallback,
	useMemo,
	type ReactNode,
} from "react";
import { useChatContext } from "@/context/ChatContext";
import { getParentPath, joinPath } from "@/lib/utils/pathSanitizer";

/**
 * FileTreeContext value interface
 * Provides state and actions for the file tree sidebar
 */
interface FileTreeContextValue {
	// State
	selectedFile: string | null;
	expandedFolders: Set<string>;

	// Navigation
	selectFile: (path: string) => void;
	expandFolder: (path: string) => void;
	collapseFolder: (path: string) => void;
	toggleFolder: (path: string) => void;
	revealFile: (path: string) => void;

	// CRUD operations (delegated to ChatContext)
	createFile: (parentPath: string, name: string) => void;
	deleteItem: (path: string) => void;
	renameItem: (oldPath: string, newPath: string) => void;

	// Utilities
	isPathFolder: (path: string) => boolean;
}

const FileTreeContext = createContext<FileTreeContextValue | null>(null);

interface FileTreeProviderProps {
	children: ReactNode;
	initialSelectedFile?: string | null;
	onFileSelect?: (path: string) => void;
}

/**
 * Provider component for file tree state management
 * Wraps the file tree sidebar and manages expand/collapse state
 */
export function FileTreeProvider({
	children,
	initialSelectedFile = null,
	onFileSelect,
}: FileTreeProviderProps) {
	const { filesMap, addFile, removeFile, renameFile } = useChatContext();

	const [selectedFile, setSelectedFile] = useState<string | null>(
		initialSelectedFile,
	);
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
		() => new Set(["root"]),
	);

	// Folder operations
	const expandFolder = useCallback((path: string) => {
		setExpandedFolders((prev) => new Set([...prev, path]));
	}, []);

	const collapseFolder = useCallback((path: string) => {
		setExpandedFolders((prev) => {
			const next = new Set(prev);
			next.delete(path);
			return next;
		});
	}, []);

	const toggleFolder = useCallback((path: string) => {
		setExpandedFolders((prev) => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	}, []);

	// Check if a path is a folder (has children in filesMap)
	const isPathFolder = useCallback(
		(path: string): boolean => {
			if (path === "root" || path === "/") return true;

			// Check if any file starts with this path as a prefix
			for (const key of filesMap.keys()) {
				if (key.startsWith(path + "/")) return true;
			}
			return false;
		},
		[filesMap],
	);

	// File selection
	const selectFile = useCallback(
		(path: string) => {
			// If it's a folder, toggle expansion instead of selecting
			if (isPathFolder(path)) {
				toggleFolder(path);
			} else {
				setSelectedFile(path);
				onFileSelect?.(path);
			}
		},
		[isPathFolder, toggleFolder, onFileSelect],
	);

	// Expand all parent folders to reveal a file
	const revealFile = useCallback(
		(path: string) => {
			let parent = getParentPath(path);
			const foldersToExpand: string[] = [];

			while (parent && parent !== "/") {
				foldersToExpand.push(parent);
				parent = getParentPath(parent);
			}

			if (foldersToExpand.length > 0) {
				setExpandedFolders((prev) => new Set([...prev, ...foldersToExpand]));
			}

			setSelectedFile(path);
			onFileSelect?.(path);
		},
		[onFileSelect],
	);

	// CRUD operations
	const createFile = useCallback(
		(parentPath: string, name: string) => {
			const newPath = joinPath(parentPath, name);
			addFile(newPath, "");
			setSelectedFile(newPath);
			onFileSelect?.(newPath);

			// Expand parent folder
			if (parentPath !== "/") {
				expandFolder(parentPath);
			}
		},
		[addFile, expandFolder, onFileSelect],
	);

	const deleteItem = useCallback(
		(path: string) => {
			const isFolder = isPathFolder(path);

			if (isFolder) {
				// Delete all files in folder
				for (const key of filesMap.keys()) {
					if (key.startsWith(path + "/") || key === path) {
						removeFile(key);
					}
				}
			} else {
				removeFile(path);
			}

			// Clear selection if deleted
			if (
				selectedFile === path ||
				(selectedFile && selectedFile.startsWith(path + "/"))
			) {
				setSelectedFile(null);
			}
		},
		[filesMap, removeFile, selectedFile, isPathFolder],
	);

	const renameItem = useCallback(
		(oldPath: string, newPath: string) => {
			const isFolder = isPathFolder(oldPath);

			if (isFolder) {
				// Rename all files in folder
				for (const key of filesMap.keys()) {
					if (key.startsWith(oldPath + "/")) {
						const newKey = key.replace(oldPath, newPath);
						renameFile(key, newKey);
					}
				}
			} else {
				renameFile(oldPath, newPath);
			}

			// Update selection
			if (selectedFile === oldPath) {
				setSelectedFile(newPath);
				onFileSelect?.(newPath);
			} else if (selectedFile && selectedFile.startsWith(oldPath + "/")) {
				const newSelected = selectedFile.replace(oldPath, newPath);
				setSelectedFile(newSelected);
				onFileSelect?.(newSelected);
			}
		},
		[filesMap, renameFile, selectedFile, isPathFolder, onFileSelect],
	);

	const value = useMemo<FileTreeContextValue>(
		() => ({
			selectedFile,
			expandedFolders,
			selectFile,
			expandFolder,
			collapseFolder,
			toggleFolder,
			revealFile,
			createFile,
			deleteItem,
			renameItem,
			isPathFolder,
		}),
		[
			selectedFile,
			expandedFolders,
			selectFile,
			expandFolder,
			collapseFolder,
			toggleFolder,
			revealFile,
			createFile,
			deleteItem,
			renameItem,
			isPathFolder,
		],
	);

	return (
		<FileTreeContext.Provider value={value}>
			{children}
		</FileTreeContext.Provider>
	);
}

/**
 * Hook to access file tree context
 * Must be used within FileTreeProvider
 */
export function useFileTree(): FileTreeContextValue {
	const context = useContext(FileTreeContext);
	if (!context) {
		throw new Error("useFileTree must be used within FileTreeProvider");
	}
	return context;
}
