import { useMemo } from "react";
import type { TreeItem } from "react-complex-tree";
import { sanitizePath } from "@/lib/utils/pathSanitizer";
import type { FileData } from "@/hooks/useFileSystem";

/**
 * Tree item data structure for file tree nodes
 */
export interface FileTreeItemData {
	name: string;
	path: string;
	isFolder: boolean;
}

export type FileTreeItem = TreeItem<FileTreeItemData>;

/**
 * Configuration limits for tree building
 */
const MAX_DEPTH = 20;
const MAX_FILES = 10000;

/**
 * Creates an empty tree structure with just a root node
 */
function getEmptyTree(): Record<string, FileTreeItem> {
	return {
		root: {
			index: "root",
			isFolder: true,
			children: [],
			data: { name: "Files", path: "/", isFolder: true },
		},
	};
}

/**
 * Builds a hierarchical tree structure from flat file paths
 * @param fileSystem - Map of file paths to FileData (flat structure)
 * @returns Record of tree items indexed by path
 */
function buildTreeFromPaths(
	fileSystem: Map<string, FileData>,
): Record<string, FileTreeItem> {
	const items: Record<string, FileTreeItem> = getEmptyTree();

	if (!fileSystem || fileSystem.size === 0) {
		return items;
	}

	// Track children for batch assignment
	const childrenMap = new Map<string, string[]>();
	childrenMap.set("root", []);

	let fileCount = 0;

	// Iterate over file paths (keys are actual paths in the new fileSystem)
	for (const rawPath of fileSystem.keys()) {
		if (fileCount++ >= MAX_FILES) {
			console.warn("Max file limit reached in tree view");
			break;
		}

		// Sanitize path
		const fullPath = sanitizePath(rawPath);
		if (!fullPath || fullPath === "/") continue;

		const segments = fullPath.split("/").filter(Boolean);

		// Prevent deeply nested paths
		if (segments.length > MAX_DEPTH) {
			console.warn(`Path exceeds max depth: ${fullPath}`);
			continue;
		}

		let currentPath = "";
		let parentKey = "root";

		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];

			// Skip empty or dangerous segments
			if (!segment || segment === "." || segment === "..") continue;

			const isLast = i === segments.length - 1;
			currentPath = "/" + segments.slice(0, i + 1).join("/");

			if (!items[currentPath]) {
				items[currentPath] = {
					index: currentPath,
					isFolder: !isLast,
					children: [],
					data: {
						name: segment,
						path: currentPath,
						isFolder: !isLast,
					},
				};

				// Track parent-child relationships
				const siblings = childrenMap.get(parentKey) || [];
				if (!siblings.includes(currentPath)) {
					siblings.push(currentPath);
					childrenMap.set(parentKey, siblings);
				}
				childrenMap.set(currentPath, []);
			}

			parentKey = currentPath;
		}
	}

	// Apply children with sorting (folders first, then alphabetical)
	for (const [key, children] of childrenMap) {
		if (items[key]) {
			items[key].children = children.sort((a, b) => {
				const aItem = items[a];
				const bItem = items[b];
				if (!aItem || !bItem) return 0;

				// Folders before files
				if (aItem.isFolder !== bItem.isFolder) {
					return bItem.isFolder ? 1 : -1;
				}

				// Alphabetical within same type
				return (aItem.data.name || "").localeCompare(bItem.data.name || "");
			});
		}
	}

	return items;
}

/**
 * Custom hook to transform fileSystem into tree data structure
 * Memoized to prevent unnecessary rebuilds
 *
 * @param fileSystem - Map of file paths to FileData from ChatContext (flat structure)
 * @returns Object containing tree items and isEmpty flag
 */
export function useFileTreeData(fileSystem: Map<string, FileData>) {
	const treeItems = useMemo(() => {
		try {
			if (!fileSystem || fileSystem.size === 0) {
				return getEmptyTree();
			}

			return buildTreeFromPaths(fileSystem);
		} catch (error) {
			console.error("Error building file tree:", error);
			return getEmptyTree();
		}
	}, [fileSystem]);

	const isEmpty = useMemo(() => {
		// Tree is empty if it only has the root node with no children
		return (
			Object.keys(treeItems).length <= 1 ||
			(treeItems.root && treeItems.root.children.length === 0)
		);
	}, [treeItems]);

	return { items: treeItems, isEmpty };
}

export { buildTreeFromPaths, getEmptyTree };
