import NoAuthLayout from "../layouts/NoAuthLayout";
import { useChatContext } from "@/context/ChatContext";
import HomeSection from "@/components/sections/home";
import ChatPanel from "./chat/ChatPanel";

export default function Home() {
	const { messages } = useChatContext();

	if (messages.length === 0) {
		return (
			<NoAuthLayout>
				<HomeSection />
			</NoAuthLayout>
		);
	}

	return <ChatPanel />;
}
