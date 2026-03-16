import type { TooltipRenderProps } from "react-joyride";
import { X } from "lucide-react";

export function JoyrideTooltip({
	continuous,
	index,
	isLastStep,
	size,
	step,
	backProps,
	closeProps,
	primaryProps,
	skipProps,
	tooltipProps,
}: TooltipRenderProps) {
	return (
		<div
			{...tooltipProps}
			className="relative w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg"
		>
			{/* Close button */}
			<button
				{...closeProps}
				className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
			>
				<X className="h-4 w-4" />
			</button>

			{/* Title */}
			{step.title && (
				<div className="mb-1 pr-6 text-base font-semibold">{step.title}</div>
			)}

			{/* Content */}
			<div className="text-sm">{step.content}</div>

			{/* Footer */}
			<div className="mt-4 flex items-center justify-between">
				{/* Skip */}
				<div>
					{index === 0 && (
						<button
							{...skipProps}
							className="text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							Skip
						</button>
					)}
				</div>

				{/* Right side: progress + nav buttons */}
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{index + 1} / {size}
					</span>
					{index > 0 && (
						<button
							{...backProps}
							className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
						>
							Back
						</button>
					)}
					{continuous && (
						<button
							{...primaryProps}
							className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
						>
							{isLastStep ? "Done" : "Next"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
