import { Button } from "@/components/ui/button";
import { FolderPlus, FileText } from "lucide-react";

interface EmptyStateProps {
	onCreateCollection: () => void;
}

export function EmptyState({ onCreateCollection }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
			<div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
				<FileText className="h-8 w-8 text-muted-foreground" />
			</div>

			<h2 className="text-xl font-semibold mb-2">No Collections Yet</h2>
			<p className="text-muted-foreground mb-6 max-w-md">
				Get started by creating your first collection to organize and manage
				your documents.
			</p>

			<Button onClick={onCreateCollection} className="flex items-center gap-2">
				<FolderPlus className="h-4 w-4" />
				Create Your First Collection
			</Button>
		</div>
	);
}
