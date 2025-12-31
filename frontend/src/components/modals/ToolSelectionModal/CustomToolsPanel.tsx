import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiToolForm } from "./ApiToolForm";
import { useCustomTools, ApiToolPayload } from "./hooks/useCustomTools";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface CustomToolsPanelProps {
	selectedTools: Set<string>;
	onToggleSelection: (toolName: string) => void;
	onViewModeChange?: (isFormActive: boolean) => void;
}

type ViewMode = "list" | "create" | "edit" | "duplicate";

export function CustomToolsPanel({
	selectedTools,
	onToggleSelection,
	onViewModeChange,
}: CustomToolsPanelProps) {
	const {
		customTools,
		isLoading,
		error,
		createTool,
		deleteTool,
		getToolForEdit,
		getToolForDuplicate,
	} = useCustomTools();

	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [editingTool, setEditingTool] = useState<
		Partial<ApiToolPayload> | undefined
	>(undefined);
	const [searchQuery, setSearchQuery] = useState("");
	const [toolToDelete, setToolToDelete] = useState<string | null>(null);

	// Notify parent when view mode changes
	useEffect(() => {
		onViewModeChange?.(viewMode !== "list");
	}, [viewMode, onViewModeChange]);

	const handleCreateClick = () => {
		setEditingTool(undefined);
		setViewMode("create");
	};

	const handleEditClick = (name: string, e: React.MouseEvent) => {
		e.stopPropagation();
		const tool = getToolForEdit(name);
		if (tool) {
			// Convert Tool to ApiToolPayload-like structure for the form
			// The hook helper should do this, but getToolForEdit returns Tool
			// We need getToolForDuplicate logic but keeping the name
			const duplicateConfig = getToolForDuplicate(tool);
			setEditingTool({
				...duplicateConfig,
				name: tool.name, // Keep name for edit
			});
			setViewMode("edit");
		}
	};

	const handleDuplicateClick = (name: string, e: React.MouseEvent) => {
		e.stopPropagation();
		const tool = getToolForEdit(name);
		if (tool) {
			const duplicateConfig = getToolForDuplicate(tool);
			setEditingTool(duplicateConfig); // Name is cleared in helper
			setViewMode("duplicate");
		}
	};

	const handleDeleteClick = (name: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setToolToDelete(name);
	};

	const handleSave = async (payload: ApiToolPayload) => {
		await createTool(payload);
		setViewMode("list");
	};

	const handleConfirmDelete = async () => {
		if (toolToDelete) {
			await deleteTool(toolToDelete);
			setToolToDelete(null);
		}
	};

	const filteredTools = customTools.filter((tool) =>
		tool.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	if (viewMode !== "list") {
		return (
			<ApiToolForm
				mode={viewMode as "create" | "edit" | "duplicate"}
				initialData={editingTool}
				onSave={handleSave}
				onCancel={() => setViewMode("list")}
			/>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex-shrink-0 border-b border-border px-8 py-6 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-2xl font-semibold text-foreground">
							Custom Tools
						</h2>
						<p className="text-sm text-muted-foreground mt-1">
							Create and manage your own API tools
						</p>
					</div>
					<Button onClick={handleCreateClick}>
						<Plus className="h-4 w-4 mr-2" />
						Create Tool
					</Button>
				</div>

				<div className="relative max-w-md">
					<Input
						placeholder="Search custom tools..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>

			{/* Tool List */}
			<div className="flex-1 overflow-y-auto p-8">
				{isLoading ? (
					<div className="flex justify-center p-8">
						<span className="animate-spin">Loading...</span>
					</div>
				) : error ? (
					<div className="bg-destructive/10 text-destructive p-4 rounded-md">
						{error}
					</div>
				) : filteredTools.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
						<div className="flex justify-center mb-4">
							<Pencil className="h-10 w-10 opacity-20" />
						</div>
						<h3 className="text-lg font-medium">No custom tools yet</h3>
						<p className="mt-2 mb-6 max-w-sm mx-auto">
							Create your first API tool to connect any REST API to your agents.
						</p>
						<Button onClick={handleCreateClick} variant="outline">
							Create Tool
						</Button>
					</div>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{filteredTools.map((tool) => (
							<div
								key={tool.name}
								className={`
									group relative border rounded-lg p-4 cursor-pointer transition-all
									hover:border-primary/50 hover:shadow-sm
									${selectedTools.has(tool.name) ? "border-primary bg-primary/5" : "border-border bg-card"}
								`}
								onClick={() => onToggleSelection(tool.name)}
							>
								<div className="flex items-start justify-between gap-4">
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<h4 className="font-semibold">{tool.name}</h4>
											{selectedTools.has(tool.name) && (
												<Badge variant="default" className="text-[10px] h-4">
													Selected
												</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground line-clamp-2">
											{tool.description || "No description"}
										</p>
										{tool.metadata?.api_config && (
											<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground font-mono">
												<span className="uppercase font-bold text-xs bg-muted px-1 rounded">
													{tool.metadata.api_config.method}
												</span>
												<span
													className="truncate max-w-[200px]"
													title={tool.metadata.api_config.base_url}
												>
													{tool.metadata.api_config.base_url}
												</span>
											</div>
										)}
									</div>

									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={(e) => handleEditClick(tool.name, e)}
											title="Edit"
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={(e) => handleDuplicateClick(tool.name, e)}
											title="Duplicate"
										>
											<Copy className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-destructive hover:text-destructive"
											onClick={(e) => handleDeleteClick(tool.name, e)}
											title="Delete"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Delete Confirmation */}
			<AlertDialog
				open={!!toolToDelete}
				onOpenChange={(open) => !open && setToolToDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the tool{" "}
							<span className="font-mono font-bold">{toolToDelete}</span>. This
							action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmDelete}
							className="bg-destructive hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
