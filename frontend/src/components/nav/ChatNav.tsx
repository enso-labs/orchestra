import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { ModelBadge } from "@/components/badges/ModelBadge";
import NewThreadButton from "../buttons/NewThreadButton";
import ShareButton from "../buttons/thread-share-button";
import { LayoutGrid, MessageSquare } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { Button } from "@/components/ui/button";

export function ChatNav({
	sidebarTrigger,
	showModelBadge = true,
}: {
	sidebarTrigger?: React.ReactNode | undefined;
	showModelBadge?: boolean;
}) {
	const { viewMode, setViewMode, filesMap, model } = useChatContext();
	const hasFiles = filesMap.size > 0;

	return (
		<header className="bg-transparent mb-1">
			<div className="mx-auto px-4 sm:px-6 lg:px-4 pt-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center">{sidebarTrigger}</div>

					<div className="flex items-center gap-2">
						{/* Mode toggle - only visible when files exist */}
						{hasFiles && (
							<div className="flex items-center gap-1 border border-border rounded-lg p-1">
								<Button
									variant={viewMode === "chat" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setViewMode("chat")}
									className="h-8 gap-2"
									aria-label="Switch to chat view"
									aria-pressed={viewMode === "chat"}
								>
									<MessageSquare className="h-4 w-4" />
									<span className="hidden sm:inline">Chat</span>
								</Button>
								<Button
									variant={viewMode === "editor" ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setViewMode("editor")}
									className="h-8 gap-2"
									aria-label="Switch to editor view"
									aria-pressed={viewMode === "editor"}
								>
									<LayoutGrid className="h-4 w-4" />
									<span className="hidden sm:inline">Editor</span>
								</Button>
							</div>
						)}

						{showModelBadge && model && (
							<ModelBadge model={model} />
						)}
						<ShareButton />
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
