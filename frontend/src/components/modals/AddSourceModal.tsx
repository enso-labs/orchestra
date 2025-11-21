import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Link as LinkIcon } from "lucide-react";
import { useProjectContext } from "@/context/ProjectContext";
import { Project, Source } from "@/lib/entities/project";

interface AddSourceModalProps {
	isOpen: boolean;
	onClose: () => void;
	project: Project | null;
}

type SourceType = "text" | "url";

export function AddSourceModal({
	isOpen,
	onClose,
	project,
}: AddSourceModalProps) {
	const { handleAddSource, loading } = useProjectContext();
	const [sourceType, setSourceType] = useState<SourceType>("text");
	const [content, setContent] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setError(null);

		if (!project?.id) {
			setError("No project selected");
			return;
		}

		if (!content.trim()) {
			setError(sourceType === "text" ? "Text content is required" : "URL is required");
			return;
		}

		if (sourceType === "url") {
			try {
				new URL(content.trim());
			} catch {
				setError("Please enter a valid URL");
				return;
			}
		}

		const source: Source = {
			type: sourceType,
			content:
				sourceType === "text"
					? { text: content.trim() }
					: { url: content.trim() },
		};

		const addedSource = await handleAddSource(project.id, source);

		if (addedSource) {
			handleClose();
		} else {
			setError("Failed to add source");
		}
	};

	const handleClose = () => {
		setSourceType("text");
		setContent("");
		setError(null);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Add Source to "{project?.name || "Project"}"
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label>Source Type</Label>
						<div className="flex gap-2">
							<Button
								type="button"
								variant={sourceType === "text" ? "default" : "outline"}
								size="sm"
								onClick={() => setSourceType("text")}
								className="flex items-center gap-1"
							>
								<FileText className="h-4 w-4" />
								Text content
							</Button>
							<Button
								type="button"
								variant={sourceType === "url" ? "default" : "outline"}
								size="sm"
								onClick={() => setSourceType("url")}
								className="flex items-center gap-1"
							>
								<LinkIcon className="h-4 w-4" />
								URL
							</Button>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="source-content">
							{sourceType === "text" ? "Content" : "URL"}{" "}
							<span className="text-red-500">*</span>
						</Label>
						{sourceType === "text" ? (
							<Textarea
								id="source-content"
								placeholder="Enter text content..."
								value={content}
								onChange={(e) => setContent(e.target.value)}
								disabled={loading}
								rows={5}
							/>
						) : (
							<Input
								id="source-content"
								type="url"
								placeholder="https://example.com"
								value={content}
								onChange={(e) => setContent(e.target.value)}
								disabled={loading}
							/>
						)}
					</div>

					{error && <p className="text-sm text-red-500">{error}</p>}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={loading}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={loading || !content.trim()}>
						{loading ? "Adding..." : "Add"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
