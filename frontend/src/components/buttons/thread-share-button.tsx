import { useState } from "react";
import { useChatContext } from "@/context/ChatContext";
import { Button } from "../ui/button";
import { Share, Check, Loader2, Link2 } from "lucide-react";
import { shareService } from "@/lib/services/shareService";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

function ShareButton() {
	const { metadata } = useChatContext();
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [allowFollowUp, setAllowFollowUp] = useState(true);
	const [showFiles, setShowFiles] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const handleCreateShare = async () => {
		const threadId = metadata?.thread_id;
		if (!threadId) return;

		setLoading(true);
		setError(null);

		try {
			const response = await shareService.createShare(threadId, {
				allow_follow_up: allowFollowUp,
				show_files: showFiles,
			});

			const fullUrl = `${window.location.origin}/share/${response.token}`;
			setShareUrl(fullUrl);
		} catch (err: any) {
			console.error("Failed to create share link:", err);
			setError(err.response?.data?.detail || "Failed to create share link");
		} finally {
			setLoading(false);
		}
	};

	const handleCopyLink = async () => {
		if (!shareUrl) return;

		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy URL:", err);
		}
	};

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			// Reset state when dialog closes
			setShareUrl(null);
			setCopied(false);
			setError(null);
		}
	};

	const threadId = metadata?.thread_id;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="h-9 w-9"
					title="Share Thread"
					disabled={!threadId}
				>
					<Share className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Share Conversation</DialogTitle>
					<DialogDescription>
						Create a shareable link for this conversation. Anyone with the link
						can view it.
					</DialogDescription>
				</DialogHeader>

				{!shareUrl ? (
					<div className="space-y-4 py-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label htmlFor="allow-follow-up">Allow follow-up</Label>
								<p className="text-sm text-muted-foreground">
									Let viewers continue the conversation
								</p>
							</div>
							<Switch
								id="allow-follow-up"
								checked={allowFollowUp}
								onCheckedChange={setAllowFollowUp}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label htmlFor="show-files">Show files</Label>
								<p className="text-sm text-muted-foreground">
									Include attached files in the shared view
								</p>
							</div>
							<Switch
								id="show-files"
								checked={showFiles}
								onCheckedChange={setShowFiles}
							/>
						</div>

						{error && <p className="text-sm text-destructive">{error}</p>}

						<Button
							onClick={handleCreateShare}
							disabled={loading}
							className="w-full"
						>
							{loading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Creating link...
								</>
							) : (
								<>
									<Link2 className="mr-2 h-4 w-4" />
									Create Share Link
								</>
							)}
						</Button>
					</div>
				) : (
					<div className="space-y-4 py-4">
						<div className="flex items-center space-x-2">
							<Input value={shareUrl} readOnly className="flex-1" />
							<Button
								variant="outline"
								size="icon"
								onClick={handleCopyLink}
								title={copied ? "Copied!" : "Copy link"}
							>
								{copied ? (
									<Check className="h-4 w-4 text-green-500" />
								) : (
									<Link2 className="h-4 w-4" />
								)}
							</Button>
						</div>
						<p className="text-sm text-muted-foreground">
							Share this link with anyone to let them view this conversation.
						</p>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

export default ShareButton;
