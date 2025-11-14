import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import SelectModel from "../lists/SelectModel";
import NewThreadButton from "../buttons/NewThreadButton";
import { LayoutGrid, MessageSquare } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { Button } from "@/components/ui/button";

export function ChatNav({
	sidebarTrigger,
}: {
	sidebarTrigger?: React.ReactNode | undefined;
}) {
	const { viewMode, setViewMode, filesMap } = useChatContext();
	const hasFiles = filesMap.size > 0;

	return (
		<header className="bg-transparent mb-1">
			<div className="mx-auto px-4 sm:px-6 lg:px-4 pt-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center">{sidebarTrigger}</div>

					<div className="flex items-center gap-2">
						{/* Mode toggle - only visible when files exist */}
						{hasFiles && (
							<div className="hidden md:flex items-center gap-1 border border-border rounded-lg p-1">
								<Button
									variant={viewMode === "chat" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setViewMode("chat")}
									className="h-8 gap-2"
								>
									<MessageSquare className="h-4 w-4" />
									Chat
								</Button>
								<Button
									variant={viewMode === "editor" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setViewMode("editor")}
									className="h-8 gap-2"
								>
									<LayoutGrid className="h-4 w-4" />
									Editor
								</Button>
							</div>
						)}

						<div className="w-56">
							<SelectModel />
						</div>
						<NewThreadButton />
						<div className="w-9">
							<ColorModeButton />
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
