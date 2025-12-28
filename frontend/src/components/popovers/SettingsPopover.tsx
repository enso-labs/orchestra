import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { logout } from "@/lib/utils/auth";
import {
	Settings,
	Cog,
	Calendar,
	FileText,
	Book,
	Globe,
	Key,
} from "lucide-react";
import { SiGithub } from "react-icons/si";
import { useNavigate } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";
import { useAuth } from "@/hooks/useAuth";

export function SettingsPopover() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const { clearMessages } = useChatContext();
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 p-3 h-auto border-sidebar-border"
				>
					<div className="flex items-center gap-3 flex-1">
						<div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
							<span className="text-sm font-medium text-sidebar-accent-foreground">
								{user?.name?.charAt(0) || "U"}
							</span>
						</div>
						<div className="flex-1 text-left min-w-0">
							<p className="text-sm font-medium truncate text-sidebar-foreground">
								{user?.name || "User"}
							</p>
							<p className="text-xs text-sidebar-foreground/60 truncate">
								{user?.email || "No email"}
							</p>
						</div>
						<Settings className="h-4 w-4 flex-shrink-0 text-sidebar-foreground/70" />
					</div>
					<span className="sr-only">Open settings menu</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="p-2 w-[var(--radix-popover-trigger-width)]"
				align="end"
			>
				<div className="flex flex-col gap-1">
					<Button
						variant="ghost"
						className="w-full justify-start gap-2 text-sm font-normal"
						onClick={() => navigate("/prompts")}
					>
						<FileText className="h-4 w-4" />
						Prompts
					</Button>
					<Button
						variant="ghost"
						className="w-full justify-start gap-2 text-sm font-normal"
						onClick={() => navigate("/schedules")}
					>
						<Calendar className="h-4 w-4" />
						Schedules
					</Button>
					<Button
						variant="ghost"
						className="w-full justify-start gap-2 text-sm font-normal"
						onClick={() =>
							window.open("https://docs.ruska.ai", "_blank", "noopener,noreferrer")
						}
					>
						<Book className="h-4 w-4" />
						Documentation
					</Button>
					<Button
						variant="ghost"
						className="w-full justify-start gap-2 text-sm font-normal"
						onClick={() => window.open("https://enso.sh", "_blank")}
					>
						<Globe className="h-4 w-4" />
						Website
					</Button>
					<Button
						variant="ghost"
						className="w-full justify-start gap-2 text-sm font-normal"
						onClick={() => window.open("https://github.com/ruska-ai", "_blank")}
					>
						<SiGithub className="h-4 w-4" />
						Github
					</Button>
					<Button
						variant="ghost"
						className="w-full justify-start gap-2 text-sm font-normal"
						onClick={() => navigate("/settings")}
					>
						<Key className="h-4 w-4" />
						Settings
					</Button>
					<Button
						onClick={() => {
							logout();
							clearMessages();
							navigate("/");
						}}
						variant="ghost"
						className="w-full justify-start gap-2 text-sm font-normal"
					>
						<Cog className="h-4 w-4" />
						Logout
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
