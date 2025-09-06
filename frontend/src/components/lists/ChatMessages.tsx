import { useEffect, useRef } from "react";
import { Loader2, Wrench } from "lucide-react";

import { useAppContext } from "@/context/AppContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import MarkdownCard from "../cards/MarkdownCard";
import DefaultTool from "../tools/Default";
import { cn } from "@/lib/utils";



function Message({ message }: { message: any }) {

	if (["human", "user"].includes(message.role)) {
		return (
			<div key={message.id} className="p-2 rounded-md bg-gray-800 m-2">
				<div className="flex justify-end">
					<div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 px-3 rounded-lg rounded-bl-sm">
						<MarkdownCard content={message.content} />
					</div>
				</div>
			</div>
		);
	}

	if (["tool"].includes(message.role || message.type)) {
		return (
			<div key={message.id} className="p-2 rounded-md bg-gray-800 m-2">
				<div className="flex items-center space-x-2">
					<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
						<Wrench className="h-4 w-4 text-primary" />
					</div>
					<div>
						<h3
							className={cn(
								"text-xs px-2 py-0.5 rounded-full",
								message.status === "success"
									? "bg-green-500/20 text-green-500"
									: "bg-red-500/20 text-red-500"
							)}
						>
							{message.name}
						</h3>
					</div>
				</div>
				<div className="flex justify-start">
					<div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 px-3 rounded-lg rounded-bl-sm">
						<MarkdownCard content={message.content} />
					</div>
				</div>
			</div>
		);
	}

	if (["ai", "assistant"].includes(message.role)) {
		return (
			<div key={message.id} className="p-2 rounded-md bg-gray-800 m-2">
				<div className="flex justify-start">
					<div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 px-3 rounded-lg rounded-bl-sm">
						<MarkdownCard content={message.content} />
					</div>
				</div>
			</div>
		);
	}

	if (["AIMessageChunk"].includes(message.role || message.type)) return <DefaultTool selectedToolMessage={message} />;

	return <p>{message.content || JSON.stringify(message.input)}</p>;
}

const ChatMessages = ({ messages }: { messages: any[] }) => {
	const bottomRef = useRef<HTMLDivElement>(null);
	const { loading, loadingMessage } = useAppContext();

	// Scroll to bottom of messages when messages change
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	if (messages.length === 0) {
		return (
			<div className="flex justify-center items-center h-full">
				<p className="text-muted-foreground">No messages yet</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<ScrollArea className="flex-1 h-0">
				{messages.length > 0 ? messages.map((message: any) => <Message message={message} />) : (
					<div className="pt-4 text-center text-muted-foreground">
						<p>No messages yet</p>
						<p className="text-sm mt-2">
							Start a conversation by typing in the input field above.
						</p>
					</div>
				)}
				<div ref={bottomRef} />
			</ScrollArea>
			{loading && (
				<div className="flex justify-start h-full mt-2">
					<Loader2 className="h-5 w-5 animate-spin mx-2" />
					<span className="text-muted-foreground">{loadingMessage}</span>
				</div>
			)}
		</div>
	);
};
export default ChatMessages;
