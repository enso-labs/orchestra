import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { logout } from "@/lib/utils/auth";
import { Settings, LayoutDashboard, Cog } from "lucide-react";
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
					className="w-full justify-start hover:bg-accent hover:text-accent-foreground flex items-center gap-3 p-3 h-auto"
				>
					<div className="flex items-center gap-3 flex-1">
						<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
							<span className="text-sm font-medium">
								{user?.name?.charAt(0) || "U"}
							</span>
						</div>
						<div className="flex-1 text-left min-w-0">
							<p className="text-sm font-medium truncate">
								{user?.name || "User"}
							</p>
							<p className="text-xs text-muted-foreground truncate">
								{user?.email || "No email"}
							</p>
						</div>
						<Settings className="h-4 w-4 flex-shrink-0" />
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
						onClick={() => navigate("/agents")}
					>
						<LayoutDashboard className="h-4 w-4" />
						Agents
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
