import { useState, useCallback, useRef } from "react";
import { FileText, FolderPlus, SearchX } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/context/ChatContext";
import { useFileTreeData, type FileTreeItem } from "@/hooks/useFileTreeData";
import { FileTreeHeader } from "./FileTreeHeader";
import { FileTreeSearch, type FileTreeSearchHandle } from "./FileTreeSearch";
import { FileTreeNode } from "./FileTreeNode";

interface FileTreeSidebarProps {
	selectedFile: string | null;
	dirtyFiles: Set<string>;
	onFileSelect: (path: string) => void;
	onNewFile: () => void;
	onRename: (path: string) => void;
	onDelete: (path: string) => void;
	isCollapsed?: boolean;
	onToggleCollapse?: () => void;
}

/**
 * Main file tree sidebar component
 * Displays hierarchical file structure with expand/collapse, search, and context menus
 */
export function FileTreeSidebar({
	selectedFile,
	dirtyFiles,
	onFileSelect,
	onNewFile,
	onRename,
	onDelete,
	isCollapsed = false,
	onToggleCollapse,
}: FileTreeSidebarProps) {
	// Use fileSystem (flat Map of path → FileData) instead of filesMap
	const { fileSystem } = useChatContext();
	const { items: treeItems, isEmpty } = useFileTreeData(fileSystem);

	// Expanded folders state
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
		() => new Set(["root"]),
	);

	// Filtered items from search
	const [filteredItems, setFilteredItems] = useState<Record<
		string,
		FileTreeItem
	> | null>(null);

	// Screen reader announcements
	const announcerRef = useRef<HTMLDivElement>(null);

	// Search component ref for clearing filter
	const searchRef = useRef<FileTreeSearchHandle>(null);

	const announce = useCallback((message: string) => {
		if (announcerRef.current) {
			announcerRef.current.textContent = message;
		}
	}, []);

	// Toggle folder expansion
	const handleToggle = useCallback(
		(path: string) => {
			setExpandedFolders((prev) => {
				const next = new Set(prev);
				if (next.has(path)) {
					next.delete(path);
					announce(`Collapsed folder`);
				} else {
					next.add(path);
					announce(`Expanded folder`);
				}
				return next;
			});
		},
		[announce],
	);

	// Handle file selection
	const handleSelect = useCallback(
		(path: string) => {
			onFileSelect(path);
			announce(`Selected file`);
		},
		[onFileSelect, announce],
	);

	// Handle filter changes from search
	const handleFilterChange = useCallback(
		(filtered: Record<string, FileTreeItem> | null) => {
			setFilteredItems(filtered);

			// Auto-expand all folders when filtering
			if (filtered) {
				const allFolders = Object.entries(filtered)
					.filter(([, item]) => item.isFolder)
					.map(([path]) => path);
				setExpandedFolders(new Set(["root", ...allFolders]));
			}
		},
		[],
	);

	// Get items to display (filtered or all)
	const displayItems = filteredItems || treeItems;

	// Render tree recursively
	const renderTreeNode = (
		itemKey: string,
		depth: number = 0,
	): React.ReactNode => {
		const item = displayItems[itemKey];
		if (!item || itemKey === "root") return null;

		const isExpanded = expandedFolders.has(itemKey);
		const isSelected = selectedFile === itemKey;
		const isDirty = dirtyFiles.has(itemKey);

		// Normalize item for FileTreeNode (ensure string types)
		const normalizedItem = {
			index: String(item.index),
			data: item.data,
			isFolder: item.isFolder,
			children: (item.children || []).map((c) => String(c)),
		};

		return (
			<div key={itemKey}>
				<FileTreeNode
					item={normalizedItem}
					depth={depth}
					isSelected={isSelected}
					isDirty={isDirty}
					isExpanded={isExpanded}
					onSelect={handleSelect}
					onToggle={handleToggle}
					onRename={onRename}
					onDelete={onDelete}
					onNewFile={onNewFile}
				/>

				{/* Render children if folder is expanded */}
				{item.isFolder && isExpanded && (item.children || []).length > 0 && (
					<div role="group" aria-label={`Contents of ${item.data.name}`}>
						{(item.children || []).map((childKey) =>
							renderTreeNode(String(childKey), depth + 1),
						)}
					</div>
				)}
			</div>
		);
	};

	// Empty state
	if (isEmpty && !filteredItems) {
		return (
			<div
				className={cn(
					"h-full flex flex-col bg-sidebar border-r border-border",
					isCollapsed && "hidden",
				)}
			>
				<FileTreeHeader
					isCollapsed={isCollapsed}
					onToggleCollapse={onToggleCollapse}
					onNewFile={onNewFile}
				/>
				<div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
					<FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
					<p className="text-sm text-muted-foreground mb-3">No files yet</p>
					<Button variant="outline" size="sm" onClick={onNewFile} className="gap-2">
						<FolderPlus className="h-4 w-4" />
						Create File
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"h-full flex flex-col bg-sidebar border-r border-border",
				isCollapsed && "hidden",
			)}
			role="tree"
			aria-label="File explorer"
		>
			{/* Screen reader announcements */}
			<div
				ref={announcerRef}
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			/>

			{/* Header */}
			<FileTreeHeader
				isCollapsed={isCollapsed}
				onToggleCollapse={onToggleCollapse}
				onNewFile={onNewFile}
			/>

			{/* Search */}
			<FileTreeSearch ref={searchRef} items={treeItems} onFilterChange={handleFilterChange} />

			{/* Tree content */}
			<ScrollArea className="flex-1">
				{/* No matches empty state */}
				{filteredItems !== null && (displayItems.root?.children || []).length === 0 ? (
					<div className="flex-1 flex flex-col items-center justify-center p-4 pt-8 text-center">
						<SearchX className="h-8 w-8 text-muted-foreground/50 mb-3" />
						<p className="text-sm text-muted-foreground mb-3">No matching files</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => searchRef.current?.clear()}
							className="gap-2"
						>
							Clear filter
						</Button>
					</div>
				) : (
					<div className="py-1" role="group" aria-label="Files">
						{(displayItems.root?.children || []).map((childKey) =>
							renderTreeNode(String(childKey), 0),
						)}
					</div>
				)}
			</ScrollArea>

			{/* Keyboard shortcuts help */}
			<div className="sr-only">
				Use arrow keys to navigate. Enter to select files or expand folders.
				Press F2 to rename. Press Delete to delete.
			</div>
		</div>
	);
}
