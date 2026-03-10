import { memo, useCallback } from "react";
import { FileText, Folder, FolderOpen, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileTreeItemData } from "@/hooks/useFileTreeData";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface FileTreeNodeProps {
	item: {
		index: string;
		data: FileTreeItemData;
		isFolder?: boolean;
		children: string[];
	};
	depth: number;
	isSelected: boolean;
	isDirty: boolean;
	isExpanded: boolean;
	onSelect: (path: string) => void;
	onToggle: (path: string) => void;
	onRename?: (path: string) => void;
	onDelete?: (path: string) => void;
	onNewFile?: (parentPath: string) => void;
}

/**
 * Custom comparison function for React.memo
 * Prevents re-renders when props haven't meaningfully changed
 */
function arePropsEqual(
	prev: FileTreeNodeProps,
	next: FileTreeNodeProps,
): boolean {
	return (
		prev.item.index === next.item.index &&
		prev.depth === next.depth &&
		prev.isSelected === next.isSelected &&
		prev.isDirty === next.isDirty &&
		prev.isExpanded === next.isExpanded
	);
}

/**
 * Individual tree node component
 * Renders a file or folder with appropriate icon and interactions
 */
export const FileTreeNode = memo(function FileTreeNode({
	item,
	depth,
	isSelected,
	isDirty,
	isExpanded,
	onSelect,
	onToggle,
	onRename,
	onDelete,
	onNewFile,
}: FileTreeNodeProps) {
	const isFolder = item.data.isFolder;

	// Determine the appropriate icon
	const Icon = isFolder ? (isExpanded ? FolderOpen : Folder) : FileText;

	// Handle click - toggle folders, select files
	const handleClick = useCallback(() => {
		if (isFolder) {
			onToggle(item.data.path);
		} else {
			onSelect(item.data.path);
		}
	}, [isFolder, item.data.path, onSelect, onToggle]);

	// Handle double-click - select and open files
	const handleDoubleClick = useCallback(() => {
		if (!isFolder) {
			onSelect(item.data.path);
		}
	}, [isFolder, item.data.path, onSelect]);

	// Context menu handlers
	const handleDelete = useCallback(() => {
		onDelete?.(item.data.path);
	}, [item.data.path, onDelete]);

	const handleNewFile = useCallback(() => {
		const parentPath = isFolder
			? item.data.path
			: item.data.path.split("/").slice(0, -1).join("/") || "/";
		onNewFile?.(parentPath);
	}, [isFolder, item.data.path, onNewFile]);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<button
					type="button"
					onClick={handleClick}
					onDoubleClick={handleDoubleClick}
					className={cn(
						"w-full flex items-center gap-1.5 py-1 text-sm text-left",
						"hover:bg-sidebar-accent rounded-sm transition-colors",
						"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
						isSelected && "bg-sidebar-accent text-sidebar-accent-foreground",
					)}
					style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: "8px" }}
					aria-selected={isSelected}
					aria-expanded={isFolder ? isExpanded : undefined}
				>
					{/* Chevron for folders */}
					{isFolder && (
						<ChevronRight
							className={cn(
								"h-3 w-3 shrink-0 transition-transform duration-150",
								isExpanded && "rotate-90",
							)}
						/>
					)}

					{/* Spacer for files to align with folders */}
					{!isFolder && <span className="w-3" />}

					{/* File/Folder icon */}
					<Icon
						className={cn(
							"h-4 w-4 shrink-0",
							isFolder ? "text-amber-500" : "text-muted-foreground",
						)}
					/>

					{/* Name */}
					<span className="truncate flex-1">{item.data.name}</span>

					{/* Dirty indicator */}
					{isDirty && (
						<span
							className="text-primary shrink-0"
							aria-label="Unsaved changes"
						>
							•
						</span>
					)}
				</button>
			</ContextMenuTrigger>

			<ContextMenuContent>
				{isFolder ? (
					<>
						<ContextMenuItem onClick={handleNewFile}>New File</ContextMenuItem>
						<ContextMenuItem
							onClick={handleDelete}
							className="text-destructive"
						>
							Delete
						</ContextMenuItem>
					</>
				) : (
					<>
						<ContextMenuItem onClick={() => onRename?.(item.data.path)}>
							Rename
						</ContextMenuItem>
						<ContextMenuItem
							onClick={handleDelete}
							className="text-destructive"
						>
							Delete
						</ContextMenuItem>
					</>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}, arePropsEqual);
