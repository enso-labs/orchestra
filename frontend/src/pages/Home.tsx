import NoAuthLayout from "../layouts/NoAuthLayout";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useChatContext } from "@/context/ChatContext";
import HomeSection from "@/components/sections/home";
import SelectModel from "@/components/selects/SelectModel";
import ChatPanel from "./chat/ChatPanel";

export default function Home() {
	const { setPayload, messages } = useChatContext();

	useEffect(() => {
		const a2a = localStorage.getItem("a2a");
		if (a2a) {
			setPayload((prev: any) => ({ ...prev, a2a: JSON.parse(a2a) }));
		}
	}, []);

	if (messages.length === 0) {
		return (
			<NoAuthLayout>
				<main className="flex-1 flex flex-col items-center justify-center bg-background p-6">
					<div className="absolute top-4 left-4">
						<Link
							to="/login"
							className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm font-medium"
						>
							Login
						</Link>
					</div>
					<div className="absolute top-4 right-4">
						<div className="flex flex-row gap-2 items-center">
							<SelectModel />
							<div className="flex-shrink-0">
								<ColorModeButton />
							</div>
						</div>
					</div>
					<HomeSection />
				</main>
			</NoAuthLayout>
		);
	}

	return <ChatPanel />;
}
