import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Memory } from "@/lib/entities/memory";
import MemoryService from "@/lib/services/memoryService";

interface MemoryEditDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	memory?: Memory | null;
	onSaved: () => void;
}

export function MemoryEditDialog({
	open,
	onOpenChange,
	memory,
	onSaved,
}: MemoryEditDialogProps) {
	const isEdit = !!memory;
	const [path, setPath] = useState("");
	const [content, setContent] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (open) {
			setContent(memory?.content ?? "");
			setPath(memory?.id ?? "");
		}
	}, [open, memory]);

	const hasChanges = isEdit
		? content !== memory?.content
		: content.trim().length > 0 && path.trim().length > 0;
	const isValid =
		content.trim().length > 0 && (isEdit || path.trim().length > 0);

	const handleSave = async () => {
		if (!isValid) return;
		setSaving(true);
		try {
			if (isEdit && memory) {
				await MemoryService.update(memory.id, { content: content.trim() });
				toast.success("Memory updated");
			} else {
				await MemoryService.create({
					content: content.trim(),
					path: path.trim(),
				});
				toast.success("Memory created");
			}
			onOpenChange(false);
			onSaved();
		} catch {
			toast.error(
				isEdit ? "Failed to update memory" : "Failed to create memory",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isEdit ? "Edit Memory" : "Add Memory"}</DialogTitle>
					<DialogDescription>
						{isEdit
							? "Update the content of this memory file."
							: "Create a new memory file that the AI will remember."}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="memory-path">File Name</Label>
						{isEdit ? (
							<p className="text-sm text-muted-foreground font-mono px-3 py-2 bg-muted rounded-md">
								{memory?.id}
							</p>
						) : (
							<Input
								id="memory-path"
								value={path}
								onChange={(e) => setPath(e.target.value)}
								placeholder="e.g. AGENTS.md, USER.md"
							/>
						)}
					</div>
					<div className="grid gap-2">
						<Label htmlFor="memory-content">Content</Label>
						<Textarea
							id="memory-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Enter memory content..."
							rows={6}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={!isValid || !hasChanges || saving}
					>
						{saving ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
