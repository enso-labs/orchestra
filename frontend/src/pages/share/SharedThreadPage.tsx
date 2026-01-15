import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import NoAuthLayout from "@/layouts/NoAuthLayout";
import { MessageSquare, AlertCircle, Share2 } from "lucide-react";
import { shareService, SharedThreadResponse } from "@/lib/services/shareService";
import { formatMessages } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import ChatMessages from "@/components/lists/ChatMessages";
import { useChatContext } from "@/context/ChatContext";
import FileEditorPanel from "@/components/panels/FileEditorPanel";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";

export default function SharedThreadPage() {
	const { shareToken } = useParams<{ shareToken: string }>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [sharedData, setSharedData] = useState<SharedThreadResponse | null>(
		null
	);
	const [formattedMessages, setFormattedMessages] = useState<any[]>([]);
	const hasFetchedRef = useRef(false);

	const { setFilesMap, setViewMode } = useChatContext();

	useEffect(() => {
		async function fetchSharedThread() {
			if (!shareToken || hasFetchedRef.current) return;
			hasFetchedRef.current = true;

			try {
				const data = await shareService.getSharedThread(shareToken);
				setSharedData(data);

				// Format and set messages locally
				if (data.thread.messages && data.thread.messages.length > 0) {
					const messages = formatMessages(data.thread.messages);
					setFormattedMessages(messages);
				}

				// Set files if present and show_files is enabled
				// filesMap expects nested structure: Map { messageId: { filename: fileData } }
				if (data.thread.files && data.config.show_files) {
					const filesMap = new Map<string, Record<string, unknown>>();
					// Wrap all files under a "shared" message ID to match expected structure
					filesMap.set("shared", data.thread.files);
					setFilesMap(filesMap);
					// Switch to files view mode to show the FileEditorPanel
					setViewMode("files");
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
	}, [shareToken, setFilesMap, setViewMode]);

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
	const hasFiles = thread.files && Object.keys(thread.files).length > 0 && config.show_files;

	// Header component to reuse in both layouts
	const Header = () => (
		<div className="flex items-center gap-2 p-4 border-b border-border shrink-0">
			<Share2 className="h-5 w-5 text-muted-foreground" />
			<h1 className="text-lg font-semibold">
				{thread.title || "Shared Conversation"}
			</h1>
		</div>
	);

	// Footer CTA component to reuse
	const FooterCTA = () => (
		<div className="shrink-0 bg-background border-t border-border p-4">
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
	);

	// If files are present and should be shown, use split panel layout
	if (hasFiles) {
		return (
			<NoAuthLayout showModelSelector={false}>
				<div className="flex flex-col w-full h-[calc(100vh-8rem)]">
					<Header />
					<div className="flex-1 min-h-0">
						<ResizablePanelGroup direction="horizontal" className="h-full">
							{/* LEFT: File Editor Panel */}
							<ResizablePanel defaultSize={60} minSize={30} maxSize={80}>
								<FileEditorPanel />
							</ResizablePanel>

							<ResizableHandle withHandle />

							{/* RIGHT: Chat Messages */}
							<ResizablePanel defaultSize={40} minSize={20} maxSize={70}>
								<div className="flex flex-col h-full overflow-hidden">
									<div className="flex-1 overflow-y-auto p-4 min-h-0">
										{formattedMessages.length > 0 ? (
											<ChatMessages messages={formattedMessages} />
										) : (
											<div className="text-center text-muted-foreground py-8">
												No messages in this thread.
											</div>
										)}
									</div>
								</div>
							</ResizablePanel>
						</ResizablePanelGroup>
					</div>
					<FooterCTA />
				</div>
			</NoAuthLayout>
		);
	}

	// Default layout without files
	return (
		<NoAuthLayout showModelSelector={false}>
			<div className="flex flex-col max-w-4xl mx-auto w-full h-[calc(100vh-8rem)]">
				<Header />

				{/* Messages - scrollable area */}
				<div className="flex-1 overflow-y-auto p-4 min-h-0">
					{formattedMessages.length > 0 ? (
						<ChatMessages messages={formattedMessages} />
					) : (
						<div className="text-center text-muted-foreground py-8">
							No messages in this thread.
						</div>
					)}
				</div>

				<FooterCTA />
			</div>
		</NoAuthLayout>
	);
}
