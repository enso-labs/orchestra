import { DollarSign } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

function formatCost(cost: number): string {
	if (cost < 0.01) return `$${cost.toFixed(4)}`;
	if (cost < 1) return `$${cost.toFixed(3)}`;
	return `$${cost.toFixed(2)}`;
}

interface CostBadgeProps {
	totalCost: number;
	turnCount: number;
	costByPhase: Record<string, number>;
}

export function CostBadge({
	totalCost,
	turnCount,
	costByPhase,
}: CostBadgeProps) {
	if (totalCost === 0) return null;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					aria-label={`Cost: ${formatCost(totalCost)}, ${turnCount} API calls`}
					className="flex h-8 items-center gap-1.5 rounded-full border border-border/60 px-3 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
				>
					<DollarSign className="h-3.5 w-3.5" />
					<span>{formatCost(totalCost)}</span>
					<span className="text-muted-foreground/60">&middot;</span>
					<span>{turnCount} calls</span>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-3" align="start">
				<div className="space-y-2">
					<div className="text-sm font-medium">Cost Breakdown</div>
					<div className="flex justify-between text-xs">
						<span className="text-muted-foreground">Total</span>
						<span className="font-mono">{formatCost(totalCost)}</span>
					</div>
					<div className="flex justify-between text-xs">
						<span className="text-muted-foreground">LLM Calls</span>
						<span className="font-mono">{turnCount}</span>
					</div>
					{Object.keys(costByPhase).length > 0 && (
						<>
							<div className="border-t border-border pt-2 text-xs font-medium">
								By Phase
							</div>
							{Object.entries(costByPhase).map(([phase, cost]) => (
								<div key={phase} className="flex justify-between text-xs">
									<span className="text-muted-foreground capitalize">
										{phase}
									</span>
									<span className="font-mono">{formatCost(cost)}</span>
								</div>
							))}
						</>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
