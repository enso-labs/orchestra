import { Plus, PanelLeftClose, PanelLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainToolTip } from "@/components/tooltips/MainToolTip";

interface FileTreeHeaderProps {
	isCollapsed?: boolean;
	onToggleCollapse?: () => void;
	onNewFile?: (parentPath?: string) => void;
	onRefresh?: () => void;
}

/**
 * Header component for the file tree sidebar
 * Contains title and action buttons (collapse, new file, refresh)
 */
export function FileTreeHeader({
	isCollapsed,
	onToggleCollapse,
	onNewFile,
	onRefresh,
}: FileTreeHeaderProps) {
	return (
		<div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-sidebar">
			{/* Title */}
			<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Explorer
			</span>

			{/* Actions */}
			<div className="flex items-center gap-0.5">
				{/* New File Button */}
				{onNewFile && (
					<MainToolTip content="New File" delayDuration={300}>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={() => onNewFile()}
							aria-label="Create new file"
						>
							<Plus className="h-3.5 w-3.5" />
						</Button>
					</MainToolTip>
				)}

				{/* Refresh Button */}
				{onRefresh && (
					<MainToolTip content="Refresh" delayDuration={300}>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={onRefresh}
							aria-label="Refresh file tree"
						>
							<RefreshCw className="h-3.5 w-3.5" />
						</Button>
					</MainToolTip>
				)}

				{/* Collapse Toggle */}
				{onToggleCollapse && (
					<MainToolTip
						content={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						delayDuration={300}
					>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={onToggleCollapse}
							aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						>
							{isCollapsed ? (
								<PanelLeft className="h-3.5 w-3.5" />
							) : (
								<PanelLeftClose className="h-3.5 w-3.5" />
							)}
						</Button>
					</MainToolTip>
				)}
			</div>
		</div>
	);
}
