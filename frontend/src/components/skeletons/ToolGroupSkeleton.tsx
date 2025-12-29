/**
 * ToolGroupSkeleton Component
 *
 * Loading skeleton for tool call groups.
 * Displays placeholder while tool calls are streaming.
 */

// ============================================================================
// Types
// ============================================================================

interface ToolGroupSkeletonProps {
	toolCount?: number;
}

// ============================================================================
// Component
// ============================================================================

export default function ToolGroupSkeleton({ toolCount = 1 }: ToolGroupSkeletonProps) {
	return (
		<div
			className="bg-muted/30 rounded-lg border border-border/50 p-3"
			role="status"
			aria-live="polite"
			aria-label="Loading tool calls"
		>
			{/* Header skeleton */}
			<div className="flex items-center gap-3 mb-3">
				<div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
				<div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
				<div className="flex-1 space-y-2">
					<div className="h-4 w-32 bg-muted rounded animate-pulse" />
					<div className="h-3 w-48 bg-muted rounded animate-pulse" />
				</div>
			</div>

			{/* Tool items skeleton */}
			<div className="space-y-2 ml-8">
				{Array.from({ length: toolCount }).map((_, index) => (
					<div
						key={index}
						className="bg-muted/20 rounded-lg p-3 space-y-2 animate-pulse"
					>
						<div className="h-4 w-24 bg-muted rounded" />
						<div className="h-3 w-full bg-muted rounded" />
						<div className="h-3 w-3/4 bg-muted rounded" />
					</div>
				))}
			</div>
		</div>
	);
}
