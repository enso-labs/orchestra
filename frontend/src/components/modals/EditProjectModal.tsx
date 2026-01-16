import { useState, useEffect } from "react";
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
import { Settings } from "lucide-react";
import { Project } from "@/lib/entities/project";

interface EditProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
	project: Project;
	onUpdate: (
		projectId: string,
		updates: Partial<Project>,
	) => Promise<Project | null>;
	loading?: boolean;
}

export function EditProjectModal({
	isOpen,
	onClose,
	project,
	onUpdate,
	loading = false,
}: EditProjectModalProps) {
	const [name, setName] = useState(project.name);
	const [description, setDescription] = useState(project.description || "");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Reset form when project changes or modal opens
	useEffect(() => {
		if (isOpen) {
			setName(project.name);
			setDescription(project.description || "");
			setError(null);
		}
	}, [isOpen, project]);

	const handleSubmit = async () => {
		setError(null);

		if (!project.id) {
			setError("Project ID is missing");
			return;
		}

		if (!name.trim()) {
			setError("Project name is required");
			return;
		}

		// Check if there are changes
		if (!hasChanges) {
			handleClose();
			return;
		}

		// Always send both fields (PUT semantics - full resource replacement)
		const updates: Partial<Project> = {
			name: name.trim(),
			description: description.trim() || "",
		};

		setSaving(true);
		try {
			const result = await onUpdate(project.id, updates);
			if (result) {
				handleClose();
			} else {
				setError("Failed to update project");
			}
		} catch {
			setError("Failed to update project");
		} finally {
			setSaving(false);
		}
	};

	const handleClose = () => {
		setName(project.name);
		setDescription(project.description || "");
		setError(null);
		onClose();
	};

	const hasChanges =
		name.trim() !== project.name ||
		(description?.trim() || "") !== (project.description || "");

	const isLoading = loading || saving;

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Edit Project Settings
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="edit-project-name">
							Name <span className="text-red-500">*</span>
						</Label>
						<Input
							id="edit-project-name"
							placeholder="Enter project name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={isLoading}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-project-description">Description</Label>
						<Textarea
							id="edit-project-description"
							placeholder="Enter project description (optional)"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={isLoading}
							rows={3}
						/>
					</div>

					{error && <p className="text-sm text-red-500">{error}</p>}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isLoading || !name.trim() || !hasChanges}
					>
						{isLoading ? "Saving..." : "Save Changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
