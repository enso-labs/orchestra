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
import { useProjectContext } from "@/context/ProjectContext";

interface CreateProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function CreateProjectModal({
	isOpen,
	onClose,
}: CreateProjectModalProps) {
	const { handleCreateProject, loading } = useProjectContext();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setError(null);

		if (!name.trim()) {
			setError("Project name is required");
			return;
		}

		const project = await handleCreateProject({
			name: name.trim(),
			description: description.trim() || undefined,
		});

		if (project) {
			handleClose();
		} else {
			setError("Failed to create project");
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
						Create Project
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="project-name">
							Name <span className="text-red-500">*</span>
						</Label>
						<Input
							id="project-name"
							placeholder="Enter project name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={loading}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="project-description">Description</Label>
						<Textarea
							id="project-description"
							placeholder="Enter project description (optional)"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={loading}
							rows={3}
						/>
					</div>

					{error && (
						<p className="text-sm text-red-500">{error}</p>
					)}
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
