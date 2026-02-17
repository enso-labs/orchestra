import { Check, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tool } from "./types";

interface ToolCardProps {
	tool: Tool;
	isSelected: boolean;
	onToggle: (toolName: string) => void;
}

export function ToolCard({ tool, isSelected, onToggle }: ToolCardProps) {
	return (
		<Card
			className={`
        relative cursor-pointer transition-all duration-150
        hover:shadow-sm hover:border-primary/30
        ${
					isSelected
						? "border-primary border-2 bg-primary/5"
						: "border-border bg-card"
				}
      `}
			onClick={() => onToggle(tool.name)}
			role="button"
			tabIndex={0}
			aria-pressed={isSelected}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onToggle(tool.name);
				}
			}}
		>
			{/* Selection Checkmark Badge */}
			{isSelected && (
				<div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
					<Check className="h-2.5 w-2.5 text-primary-foreground" />
				</div>
			)}

			<div className="flex flex-col items-center text-center p-3 sm:p-4 space-y-2">
				{/* Icon */}
				<div className="w-8 h-8 flex items-center justify-center">
					<Wrench className="h-8 w-8 text-foreground" />
				</div>

				{/* Tool Name */}
				<h3 className="text-sm font-semibold text-foreground leading-tight">
					{tool.name}
				</h3>

				{/* Description */}
				<p className="text-xs text-muted-foreground line-clamp-2 leading-normal min-h-[2rem]">
					{tool.description}
				</p>

				{/* Tags */}
				{tool.tags && tool.tags.length > 0 && (
					<div className="flex flex-wrap gap-1 justify-center">
						{tool.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className="px-1.5 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded-full"
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>
		</Card>
	);
}
