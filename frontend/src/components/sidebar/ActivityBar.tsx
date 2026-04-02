import {
	Bot,
	Brain,
	FolderKanban,
	Calendar,
	MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityBarItem } from "./ActivityBarItem";
import { SettingsPopover } from "@/components/popovers/SettingsPopover";

export type PanelId =
	| "assistants"
	| "memories"
	| "projects"
	| "schedules"
	| "threads";

interface ActivityBarProps {
	activePanel: PanelId | null;
	onPanelToggle: (panelId: PanelId) => void;
	onLogoClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
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

export function ActivityBar({
	activePanel,
	onPanelToggle,
	onLogoClick,
}: ActivityBarProps) {
	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex flex-col items-center w-12 shrink-0 border-r border-sidebar-border bg-sidebar h-full">
				{/* Logo */}
				<Link
					to="/"
					onClick={onLogoClick}
					className="flex items-center justify-center w-full h-12 shrink-0"
				>
					<img
						src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
						alt="Logo"
						className="w-7 h-7 rounded-full"
					/>
				</Link>

				{/* Nav Icons */}
				<div
					className="flex flex-col items-center w-full flex-1 gap-0.5 pt-1"
					data-tour="sidebar"
				>
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

				{/* Settings at bottom */}
				<div className="shrink-0 pb-2" data-tour="settings-popover">
					<SettingsPopover />
				</div>
			</div>
		</TooltipProvider>
	);
}
