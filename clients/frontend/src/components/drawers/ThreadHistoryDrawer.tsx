import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatContext } from "@/context/ChatContext";
import { Link } from "react-router-dom";
import { SettingsPopover } from "@/components/popovers/SettingsPopover";
import ListThreads from "../lists/ListThreads";
import useLinkClick from "@/hooks/useLinkClick";

interface ThreadHistoryDrawerProps {
	isOpen: boolean;
	onClose: () => void;
}

export function ThreadHistoryDrawer({
	isOpen,
	onClose,
}: ThreadHistoryDrawerProps) {
	const { threads } = useChatContext();

	return (
		<>
			{/* Overlay for mobile - only shows when drawer is open */}
			{isOpen && (
				<div
					className="fixed inset-0 bg-black/50 z-30 md:hidden"
					onClick={onClose}
				/>
			)}

			<div
				className={`
        absolute md:relative w-[300px] border-r border-border flex flex-col h-[calc(100vh-0px)]
        ${isOpen ? "flex" : "hidden md:flex"}
        bg-background z-40
      `}
			>
				<div className="p-4 border-b border-border">
					<Link
						to="/"
						onClick={(e) => {
							const handleLinkClick = useLinkClick("/");
							handleLinkClick(
								e as React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
							);
						}}
						className="flex items-center gap-2"
					>
						<img
							src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
							alt="Logo"
							className="w-8 h-8 rounded-full"
						/>
						<h1 className="text-2xl font-bold text-foreground">Ensō</h1>
					</Link>
				</div>

				<ScrollArea className="flex-1">
					<div className="p-2 space-y-2">
						<ListThreads threads={threads} />
					</div>
				</ScrollArea>

				<div className="p-4 border-t border-border">
					<SettingsPopover />
				</div>
			</div>
		</>
	);
}
