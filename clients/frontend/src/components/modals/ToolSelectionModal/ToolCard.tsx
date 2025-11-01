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
				<div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
					<Check className="h-3 w-3 text-primary-foreground" />
				</div>
			)}

			<div className="flex flex-col items-center text-center p-6 space-y-3">
				{/* Icon */}
				<div className="w-12 h-12 flex items-center justify-center">
					<Wrench className="h-12 w-12 text-foreground" />
				</div>

				{/* Tool Name */}
				<h3 className="text-base font-semibold text-foreground">{tool.name}</h3>

				{/* Description */}
				<p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed min-h-[2.5rem]">
					{tool.description}
				</p>

				{/* Tags */}
				{tool.tags && tool.tags.length > 0 && (
					<div className="flex flex-wrap gap-1 justify-center">
						{tool.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className="px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded-full"
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
