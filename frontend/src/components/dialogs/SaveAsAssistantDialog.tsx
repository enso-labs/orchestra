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
import { Bot } from "lucide-react";

interface SaveAsAssistantDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (name: string, description: string) => void;
}

export function SaveAsAssistantDialog({
	isOpen,
	onClose,
	onSave,
}: SaveAsAssistantDialogProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = () => {
		setError(null);

		if (!name.trim()) {
			setError("Assistant name is required");
			return;
		}

		onSave(name.trim(), description.trim());
		handleClose();
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
						<Bot className="h-5 w-5" />
						Save as Assistant
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="assistant-name">
							Name <span className="text-red-500">*</span>
						</Label>
						<Input
							id="assistant-name"
							placeholder="Enter assistant name"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="assistant-description">Description</Label>
						<Textarea
							id="assistant-description"
							placeholder="Enter assistant description (optional)"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
						/>
					</div>

					{error && <p className="text-sm text-red-500">{error}</p>}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!name.trim()}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
