import { useState } from "react";
import { useChatContext } from "@/context/ChatContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ListOrdered, Pencil, X, Check } from "lucide-react";
import type { QueuedMessage } from "@/lib/entities/queue";

interface QueueItemProps {
	item: QueuedMessage;
	index: number;
	onEdit: (id: string, query: string) => void;
	onRemove: (id: string) => void;
	onEditingChange: (id: string | null) => void;
}

function QueueItem({
	item,
	index,
	onEdit,
	onRemove,
	onEditingChange,
}: QueueItemProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(item.query);

	const startEditing = () => {
		setEditValue(item.query);
		setIsEditing(true);
		onEditingChange(item.id);
	};

	const handleSave = () => {
		if (editValue.trim()) {
			onEdit(item.id, editValue.trim());
		}
		setIsEditing(false);
		onEditingChange(null);
	};

	const handleCancel = () => {
		setEditValue(item.query);
		setIsEditing(false);
		onEditingChange(null);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			// Ctrl/Cmd + Enter to save (allows regular Enter for newlines)
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			handleCancel();
		}
	};

	return (
		<div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
			{/* Index number */}
			<div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-sm font-medium">
				{index}
			</div>

			{/* Message content */}
			<div className="flex-1 min-w-0">
				{isEditing ? (
					<Textarea
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={handleCancel}
						autoFocus
						className="min-h-[60px] max-h-[120px] text-sm resize-none"
						placeholder="Enter your message..."
					/>
				) : (
					<p className="text-sm whitespace-pre-wrap line-clamp-3">
						{item.query}
					</p>
				)}
				<Badge variant="secondary" className="mt-1 text-xs">
					Pending
				</Badge>
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-1">
				{isEditing ? (
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onMouseDown={(e) => {
							e.preventDefault();
							handleSave();
						}}
						title="Save"
					>
						<Check className="h-4 w-4" />
					</Button>
				) : (
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={startEditing}
						title="Edit"
					>
						<Pencil className="h-4 w-4" />
					</Button>
				)}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-destructive hover:text-destructive"
					onClick={() => onRemove(item.id)}
					title="Remove"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

export function QueuePanel() {
	const {
		queuedItems,
		queueLength,
		updateQueuedMessage,
		dequeue,
		setEditingId,
	} = useChatContext();

	if (queueLength === 0) {
		return null;
	}

	return (
		<div className="bg-background border border-border rounded-lg mb-2">
			{/* Header */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border">
				<ListOrdered className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm font-medium">
					{queueLength} message{queueLength !== 1 ? "s" : ""} queued
				</span>
			</div>

			{/* Queue items list */}
			<div className="p-2 space-y-2 max-h-48 overflow-y-auto">
				{queuedItems.map((item: QueuedMessage, index: number) => (
					<QueueItem
						key={item.id}
						item={item}
						index={index + 1}
						onEdit={updateQueuedMessage}
						onRemove={dequeue}
						onEditingChange={setEditingId}
					/>
				))}
			</div>
		</div>
	);
}

export default QueuePanel;
