import { FaPlus } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { useChatContext } from "@/context/ChatContext";
import { Menu, Share } from "lucide-react";
import SelectModel from "../lists/SelectModel";

interface ChatNavProps {
	onMenuClick: () => void;
	onNewChat?: () => void;
}

export function ChatNav({ onMenuClick, onNewChat }: ChatNavProps) {
	const { payload, messages, clearMessages } = useChatContext();

	return (
		<header className="bg-transparent">
			<div className="mx-auto px-4 sm:px-6 lg:px-4 pt-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center">
						<button
							onClick={onMenuClick}
							className="inline-flex md:hidden items-center text-muted-foreground hover:text-foreground transition-colors mr-4"
						>
							<Menu className="h-5 w-5" />
						</button>
					</div>

					<div className="flex items-center gap-2">
						<div className="w-36">
							<SelectModel />
						</div>
						<div className="w-9">
							<Button
								variant="outline"
								size="icon"
								onClick={() => {
									const { threadId } = payload;
									if (threadId) {
										const shareUrl = `${window.location.origin}/share/${threadId}`;
										navigator.clipboard
											.writeText(shareUrl)
											.then(() => {
												alert(`Copied ${shareUrl}`);
											})
											.catch((err) => {
												console.error("Failed to copy URL: ", err);
											});
									}
								}}
								className="h-9 w-9"
								title="Share Thread"
							>
								<Share className="h-4 w-4" />
							</Button>
						</div>
						{messages.length > 0 && (
							<div className="w-9">
								<Button
									variant="outline"
									size="icon"
									onClick={onNewChat || clearMessages}
									className="h-9 w-9"
									title="New Chat"
								>
									<FaPlus className="h-4 w-4" />
								</Button>
							</div>
						)}
						<div className="w-9">
							<ColorModeButton />
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
