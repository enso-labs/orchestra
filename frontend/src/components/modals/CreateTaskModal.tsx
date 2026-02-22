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
import { ListChecks } from "lucide-react";
import { useEpicContext } from "@/context/EpicContext";

interface CreateTaskModalProps {
	isOpen: boolean;
	onClose: () => void;
	epicId: string;
}

export function CreateTaskModal({
	isOpen,
	onClose,
	epicId,
}: CreateTaskModalProps) {
	const { handleCreateTask, loading } = useEpicContext();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setError(null);

		if (!title.trim()) {
			setError("Task title is required");
			return;
		}

		const task = await handleCreateTask(epicId, {
			title: title.trim(),
			description: description.trim() || undefined,
			epic_id: epicId,
			blockers: [],
		});

		if (task) {
			handleClose();
		} else {
			setError("Failed to create task");
		}
	};

	const handleClose = () => {
		setTitle("");
		setDescription("");
		setError(null);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ListChecks className="h-5 w-5" />
						Create Task
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="task-title">
							Title <span className="text-red-500">*</span>
						</Label>
						<Input
							id="task-title"
							placeholder="Enter task title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							disabled={loading}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="task-description">Description</Label>
						<Textarea
							id="task-description"
							placeholder="Enter task description (optional)"
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
					<Button onClick={handleSubmit} disabled={loading || !title.trim()}>
						{loading ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
