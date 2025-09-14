import { FaStop } from "react-icons/fa";
import { MainToolTip } from "../tooltips/MainToolTip";
import { Button } from "../ui/button";
import { useChatContext } from "@/context/ChatContext";
import { ArrowUp } from "lucide-react";

function ChatSubmitButton({
	abortQuery,
	handleSubmit,
}: {
	abortQuery: () => void;
	handleSubmit: () => void;
}) {
	const { controller, query, images } = useChatContext();

	if (controller) {
		return (
			<MainToolTip content="Abort" delayDuration={500}>
				<Button
					onClick={abortQuery}
					size="icon"
					className="w-8 h-8 rounded-full m-1 bg-red-500"
				>
					<FaStop />
				</Button>
			</MainToolTip>
		);
	}

	return (
		<MainToolTip content="Send Message" delayDuration={500}>
			<Button
				onClick={(e) => {
					e.stopPropagation();
					handleSubmit();
				}}
				disabled={query.trim() === "" && images.length === 0}
				size="icon"
				className="w-8 h-8 rounded-full m-1"
			>
				<ArrowUp className="h-4 w-4" />
			</Button>
		</MainToolTip>
	);
}

export default ChatSubmitButton;
