import { type ReactNode, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, Search } from "lucide-react";
import { SidebarMenu } from "@/components/ui/sidebar";
import { Project } from "@/lib/entities/project";

interface ThreadsPanelProps {
	threads: any[];
	projects: Project[];
	loadMore?: (filter?: any) => Promise<void>;
	hasMore?: boolean;
	isLoadingMore?: boolean;
	onSearchClick?: () => void;
	renderThreadItem: (thread: any, projects: Project[]) => ReactNode;
}

export function ThreadsPanel({
	threads,
	projects,
	loadMore,
	hasMore = false,
	isLoadingMore = false,
	onSearchClick,
	renderThreadItem,
}: ThreadsPanelProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const getScrollElement = useCallback(() => scrollRef.current, []);
	const estimateSize = useCallback(() => 100, []);

	const virtualizer = useVirtualizer({
		count: threads.length,
		getScrollElement,
		estimateSize,
		overscan: 5,
	});

	const isNearBottom = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return false;
		return el.scrollHeight - el.scrollTop - el.clientHeight < 200;
	}, []);

	const handleScroll = useCallback(() => {
		if (isNearBottom() && hasMore && !isLoadingMore && loadMore) {
			loadMore({});
		}
	}, [isNearBottom, hasMore, isLoadingMore, loadMore]);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
				<span className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/70">
					Threads
				</span>
				{onSearchClick && (
					<button
						onClick={onSearchClick}
						className="p-1 hover:bg-sidebar-accent rounded text-sidebar-foreground/60 hover:text-sidebar-foreground"
						title="Search threads"
					>
						<Search className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="overflow-auto flex-1 px-1 pt-1"
			>
				<SidebarMenu
					className="gap-0"
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						position: "relative",
					}}
				>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const item = threads[virtualRow.index];
						return (
							<div
								key={item.key ?? virtualRow.index}
								data-index={virtualRow.index}
								ref={virtualizer.measureElement}
								className="absolute top-0 left-0 w-full"
								style={{
									transform: `translateY(${virtualRow.start}px)`,
								}}
							>
								{renderThreadItem(item, projects)}
							</div>
						);
					})}
				</SidebarMenu>
				{isLoadingMore && (
					<div className="flex items-center justify-center gap-2 p-3 text-sm text-sidebar-foreground/60">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span>Loading more threads...</span>
					</div>
				)}
				{threads.length === 0 && !isLoadingMore && (
					<div className="px-3 py-4 text-center text-sm text-sidebar-foreground/50">
						No threads yet
					</div>
				)}
			</div>
		</div>
	);
}
