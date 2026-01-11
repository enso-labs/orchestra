import {
	useState,
	useMemo,
	useDeferredValue,
	useEffect,
	forwardRef,
	useImperativeHandle,
} from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FileTreeItem } from "@/hooks/useFileTreeData";

interface FileTreeSearchProps {
	items: Record<string, FileTreeItem>;
	onFilterChange: (filteredItems: Record<string, FileTreeItem> | null) => void;
}

export interface FileTreeSearchHandle {
	clear: () => void;
}

/**
 * Search/filter component for the file tree
 * Uses useDeferredValue for smooth filtering of large trees
 */
export const FileTreeSearch = forwardRef<
	FileTreeSearchHandle,
	FileTreeSearchProps
>(function FileTreeSearch({ items, onFilterChange }, ref) {
	const [query, setQuery] = useState("");

	// Defer expensive filtering to avoid blocking UI
	const deferredQuery = useDeferredValue(query);

	// Filter tree items based on search query
	const filteredItems = useMemo(() => {
		const trimmedQuery = deferredQuery.trim().toLowerCase();

		// No filter active
		if (!trimmedQuery) return null;

		const matching = new Set<string>();

		// Find matching items
		for (const [path, item] of Object.entries(items)) {
			if (item.data.name.toLowerCase().includes(trimmedQuery)) {
				matching.add(path);

				// Include all ancestors to maintain tree structure
				const segments = path.split("/").filter(Boolean);
				let ancestorPath = "";
				for (let i = 0; i < segments.length - 1; i++) {
					ancestorPath = "/" + segments.slice(0, i + 1).join("/");
					matching.add(ancestorPath);
				}
			}
		}

		// Build filtered tree
		const filtered: Record<string, FileTreeItem> = {
			root: {
				...items.root,
				children: (items.root.children || []).filter((c) =>
					matching.has(String(c)),
				),
			},
		};

		for (const path of matching) {
			if (items[path] && path !== "root") {
				filtered[path] = {
					...items[path],
					children: (items[path].children || []).filter((c) =>
						matching.has(String(c)),
					),
				};
			}
		}

		return filtered;
	}, [items, deferredQuery]);

	// Notify parent of filter changes
	useEffect(() => {
		onFilterChange(filteredItems);
	}, [filteredItems, onFilterChange]);

	const handleClear = () => {
		setQuery("");
	};

	// Expose clear method to parent via ref
	useImperativeHandle(
		ref,
		() => ({
			clear: handleClear,
		}),
		[],
	);

	return (
		<div className="px-2 py-1.5">
			<div className="relative">
				<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
				<Input
					placeholder="Search files..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="h-7 pl-7 pr-7 text-xs bg-background"
					aria-label="Search files"
				/>
				{query && (
					<Button
						variant="ghost"
						size="icon"
						className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
						onClick={handleClear}
						aria-label="Clear search"
					>
						<X className="h-3 w-3" />
					</Button>
				)}
			</div>
		</div>
	);
});
