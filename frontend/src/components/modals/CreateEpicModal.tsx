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
import { FolderKanban } from "lucide-react";
import { useEpicContext } from "@/context/EpicContext";

interface CreateEpicModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function CreateEpicModal({ isOpen, onClose }: CreateEpicModalProps) {
	const { handleCreateEpic, loading } = useEpicContext();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setError(null);

		if (!name.trim()) {
			setError("Epic name is required");
			return;
		}

		const epic = await handleCreateEpic({
			name: name.trim(),
			description: description.trim() || undefined,
		});

		if (epic) {
			handleClose();
		} else {
			setError("Failed to create epic");
		}
	};

	const handleClose = () => {
		setName("");
		setDescription("");
		setError(null);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FolderKanban className="h-5 w-5" />
						Create Epic
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="epic-name">
							Name <span className="text-red-500">*</span>
						</Label>
						<Input
							id="epic-name"
							placeholder="Enter epic name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={loading}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="epic-description">Description</Label>
						<Textarea
							id="epic-description"
							placeholder="Enter epic description (optional)"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={loading}
							rows={3}
						/>
					</div>

					{error && <p className="text-sm text-red-500">{error}</p>}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={loading}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={loading || !name.trim()}>
						{loading ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
