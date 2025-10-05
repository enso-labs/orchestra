import { useChatContext } from "@/context/ChatContext";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";

function NewThreadButton() {
	const { messages, clearMessages } = useChatContext();

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (e.ctrlKey) {
			window.open(window.location.href, "_blank");
		} else {
			clearMessages();
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
