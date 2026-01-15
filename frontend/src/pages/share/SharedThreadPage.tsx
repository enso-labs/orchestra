import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import NoAuthLayout from "@/layouts/NoAuthLayout";
import { MessageSquare, AlertCircle, Share2 } from "lucide-react";
import { shareService, SharedThreadResponse } from "@/lib/services/shareService";
import { formatMessages } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import ChatMessages from "@/components/lists/ChatMessages";
import { useChatContext } from "@/context/ChatContext";

export default function SharedThreadPage() {
	const { shareToken } = useParams<{ shareToken: string }>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [sharedData, setSharedData] = useState<SharedThreadResponse | null>(
		null
	);

	const { messages, setMessages, setFilesMap } = useChatContext();

	useEffect(() => {
		async function fetchSharedThread() {
			if (!shareToken) return;

			try {
				const data = await shareService.getSharedThread(shareToken);
				setSharedData(data);

				// Format and set messages
				if (data.thread.messages && data.thread.messages.length > 0) {
					const formattedMessages = formatMessages(data.thread.messages);
					setMessages(formattedMessages);
				}

				// Set files if present
				if (data.thread.files) {
					const filesMap = new Map(Object.entries(data.thread.files));
					setFilesMap(filesMap);
				}
			} catch (err: any) {
				console.error("Error loading shared thread:", err);
				setError(
					err.response?.data?.detail || "This shared link is not available"
				);
			} finally {
				setLoading(false);
			}
		}

		fetchSharedThread();
	}, [shareToken, setMessages, setFilesMap]);

	if (loading) {
		return (
			<NoAuthLayout>
				<div className="flex items-center justify-center h-full">
					<MessageSquare className="h-8 w-8 animate-pulse text-muted-foreground" />
				</div>
			</NoAuthLayout>
		);
	}

	if (error || !sharedData) {
		return (
			<NoAuthLayout>
				<div className="text-center py-12">
					<AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
					<h3 className="text-lg font-semibold mb-2">
						Shared Thread Not Found
					</h3>
					<p className="text-muted-foreground mb-4">
						{error || "This shared link may have expired or been revoked"}
					</p>
					<Link to="/">
						<Button variant="outline">Go to Home</Button>
					</Link>
				</div>
			</NoAuthLayout>
		);
	}

	const { thread, config } = sharedData;

	return (
		<NoAuthLayout showModelSelector={false}>
			<div className="flex flex-col h-full max-w-4xl mx-auto w-full">
				{/* Header */}
				<div className="flex items-center gap-2 p-4 border-b border-border">
					<Share2 className="h-5 w-5 text-muted-foreground" />
					<h1 className="text-lg font-semibold">
						{thread.title || "Shared Conversation"}
					</h1>
				</div>

				{/* Messages */}
				<div className="flex-1 min-h-0 overflow-auto p-4">
					{messages.length > 0 ? (
						<ChatMessages messages={messages} />
					) : (
						<div className="text-center text-muted-foreground py-8">
							No messages in this thread.
						</div>
					)}
				</div>

				{/* Footer with CTA */}
				<div className="sticky bottom-0 bg-background border-t border-border p-4">
					<div className="bg-muted/50 rounded-lg p-4 text-center">
						<p className="text-sm text-muted-foreground mb-3">
							{config.allow_follow_up
								? "Want to continue this conversation?"
								: "This is a view-only shared conversation."}
						</p>
						<div className="flex gap-2 justify-center">
							<Link to="/register">
								<Button variant="default">Sign up for free</Button>
							</Link>
							<Link to="/login">
								<Button variant="outline">Log in</Button>
							</Link>
						</div>
					</div>
				</div>
			</div>
		</NoAuthLayout>
	);
}
