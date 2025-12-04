import { useChatContext } from "@/context/ChatContext";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

function NewThreadButton() {
	const { messages, clearMessages, metadata } = useChatContext();
	const navigate = useNavigate();
	const location = useLocation();

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (e.ctrlKey) {
			window.open(window.location.href, "_blank");
		} else {
			clearMessages();
			const pathname = location.pathname;

			// Handle thread routes
			if (pathname.startsWith("/thread/")) {
				// On /thread/:threadId - go back to chat
				navigate("/chat");
			} else if (pathname.startsWith("/assistant/")) {
				// On /assistant/:agentId/thread/:threadId - go to agent thread page
				navigate(`/assistant/${metadata?.assistant_id}`);
			} else if (pathname.match(/^\/p\/[^/]+\/t\//)) {
				// On /p/:projectId/t/:threadId - extract projectId and go to project page
				const projectId = pathname.split("/")[2];
				navigate(`/p/${projectId}`);
			} else if (pathname.startsWith("/p/") && !metadata?.project_id) {
				// On project page but no project_id in metadata - go to chat
				navigate("/chat");
			}
		}
	};

	if (messages.length > 0) {
		return (
			<div className="w-9">
				<Button
					size="icon"
					onClick={handleClick}
					variant="outline"
					className="h-9 w-9"
					title="New Chat"
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	return null;
}

export default NewThreadButton;
