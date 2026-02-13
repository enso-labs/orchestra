import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import NoAuthLayout from "@/layouts/NoAuthLayout";
import { MessageSquare, AlertCircle, Share2 } from "lucide-react";
import {
	shareService,
	SharedThreadResponse,
} from "@/lib/services/shareService";
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
import { useIsMobile } from "@/hooks/use-mobile";

export default function SharedThreadPage() {
	const { shareToken } = useParams<{ shareToken: string }>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [sharedData, setSharedData] = useState<SharedThreadResponse | null>(
		null,
	);
	const [formattedMessages, setFormattedMessages] = useState<any[]>([]);
	const lastFetchedTokenRef = useRef<string | null>(null);
	const isMobile = useIsMobile();

	const { setFilesMap, setViewMode } = useChatContext();

	useEffect(() => {
		async function fetchSharedThread() {
			// Skip if no token or if we've already fetched this token
			if (!shareToken || lastFetchedTokenRef.current === shareToken) return;

			setLoading(true);
			setError(null);

			try {
				const data = await shareService.getSharedThread(shareToken);
				setSharedData(data);
				lastFetchedTokenRef.current = shareToken;

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
					err.response?.data?.detail || "This shared link is not available",
				);
				lastFetchedTokenRef.current = null;
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
	const hasFiles =
		thread.files && Object.keys(thread.files).length > 0 && config.show_files;

	// Header component to reuse in both layouts
	const Header = () => (
		<div className="flex items-center justify-between p-4 border-b border-border shrink-0">
			<div className="flex items-center gap-4">
				{/* Branding */}
				<Link to="/" className="flex items-center gap-0.5">
					<img
						src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
						alt="Logo"
						className="w-8 h-8 rounded-full"
					/>
					<h1 className="text-2xl font-bold text-foreground italic">
						RCHESTRA
					</h1>
				</Link>
				{/* Separator */}
				<div className="h-6 w-px bg-border" />
				{/* Share info */}
				<div className="flex items-center gap-2">
					<Share2 className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm text-muted-foreground">
						{thread.title || "Shared Conversation"}
					</span>
				</div>
			</div>
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
	// On mobile: vertical layout (stacked), on desktop: horizontal layout (side-by-side)
	if (hasFiles) {
		return (
			<NoAuthLayout>
				<div className="flex flex-col w-full h-[calc(100vh-8rem)]">
					<Header />
					<div className="flex-1 min-h-0">
						<ResizablePanelGroup
							direction={isMobile ? "vertical" : "horizontal"}
							className="h-full"
						>
							{/* File Editor Panel - TOP on mobile, LEFT on desktop */}
							<ResizablePanel
								defaultSize={isMobile ? 50 : 60}
								minSize={isMobile ? 20 : 30}
								maxSize={isMobile ? 80 : 80}
							>
								<FileEditorPanel />
							</ResizablePanel>

							<ResizableHandle withHandle />

							{/* Chat Messages - BOTTOM on mobile, RIGHT on desktop */}
							<ResizablePanel
								defaultSize={isMobile ? 50 : 40}
								minSize={isMobile ? 20 : 20}
								maxSize={isMobile ? 80 : 70}
							>
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
		<NoAuthLayout>
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
