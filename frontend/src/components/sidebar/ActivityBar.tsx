import {
	Bot,
	Brain,
	FolderKanban,
	Calendar,
	MessageSquare,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityBarItem } from "./ActivityBarItem";

export type PanelId =
	| "assistants"
	| "memories"
	| "projects"
	| "schedules"
	| "threads";

interface ActivityBarProps {
	activePanel: PanelId | null;
	onPanelToggle: (panelId: PanelId) => void;
}

const NAV_ITEMS: {
	id: PanelId;
	icon: typeof Bot;
	label: string;
	tour?: string;
}[] = [
	{ id: "assistants", icon: Bot, label: "Assistants", tour: "assistants-link" },
	{ id: "memories", icon: Brain, label: "Memories", tour: "memories-link" },
	{
		id: "projects",
		icon: FolderKanban,
		label: "Projects",
		tour: "projects-section",
	},
	{ id: "schedules", icon: Calendar, label: "Schedules" },
	{
		id: "threads",
		icon: MessageSquare,
		label: "Threads",
		tour: "threads-section",
	},
];

export function ActivityBar({ activePanel, onPanelToggle }: ActivityBarProps) {
	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex items-center gap-1 px-2 py-2 border-b border-sidebar-border">
				{NAV_ITEMS.map((item) => (
					<ActivityBarItem
						key={item.id}
						icon={item.icon}
						label={item.label}
						isActive={activePanel === item.id}
						onClick={() => onPanelToggle(item.id)}
						data-tour={item.tour}
					/>
				))}
			</div>
		</TooltipProvider>
	);
}
