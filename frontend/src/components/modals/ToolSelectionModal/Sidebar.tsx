import { Wrench, Server, Users, Gamepad2 } from "lucide-react";
import { ToolCategory, CategoryConfig } from "./types";

const categories: CategoryConfig[] = [
	{ id: "platform", label: "Platform", icon: Wrench },
	{ id: "mcp", label: "MCP Servers", icon: Server },
	{ id: "a2a", label: "A2A Agents", icon: Users },
	{ id: "arcade", label: "Arcade", icon: Gamepad2 },
];

interface SidebarProps {
	activeCategory: ToolCategory;
	onCategoryChange: (category: ToolCategory) => void;
}

export function Sidebar({ activeCategory, onCategoryChange }: SidebarProps) {
	return (
		<div className="w-60 border-r border-border flex-shrink-0">
			<nav className="p-4 space-y-1">
				{categories.map((category) => {
					const Icon = category.icon;
					const isActive = activeCategory === category.id;

					return (
						<button
							key={category.id}
							onClick={() => onCategoryChange(category.id)}
							className={`
                w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
                text-sm font-medium transition-colors
                ${
									isActive
										? "bg-muted text-foreground border-l-2 border-primary"
										: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
								}
              `}
							aria-current={isActive ? "page" : undefined}
						>
							<Icon className="h-4 w-4" />
							<span>{category.label}</span>
						</button>
					);
				})}
			</nav>
		</div>
	);
}
