import { useSearchParams } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";

export default function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const [searchParams, setSearchParams] = useSearchParams();
	const currentModel = searchParams.get("model") || "";
	const { useFetchModelsEffect, useSelectModelEffect } = useChatContext();

	useFetchModelsEffect(setSearchParams, currentModel);
	useSelectModelEffect(currentModel);

	return (
		<div className="min-h-screen flex flex-col bg-background">{children}</div>
	);
}
