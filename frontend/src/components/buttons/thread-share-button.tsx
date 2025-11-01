import { useChatContext } from "@/context/ChatContext";
import { Button } from "../ui/button";
import { Share } from "lucide-react";

function ShareButton() {
	const { payload } = useChatContext();

	return (
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
	);
}

export default ShareButton;
