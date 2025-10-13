import { useState, useMemo } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Globe, Lock, FileText } from "lucide-react";
import { usePromptContext } from "@/context/PromptContext";
import { Prompt } from "@/lib/entities/prompt";

type FilterType = "all" | "mine" | "public";

interface PromptSelectionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (prompt: Prompt) => void;
}

export function PromptSelectionModal({
	isOpen,
	onClose,
	onSelect,
}: PromptSelectionModalProps) {
	const { prompts, isLoading } = usePromptContext();
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<FilterType>("all");
	const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

	const filteredPrompts = useMemo(() => {
		let filtered = prompts;

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(prompt: Prompt) =>
					prompt.name.toLowerCase().includes(query) ||
					prompt.content.toLowerCase().includes(query),
			);
		}

		// Apply visibility filter
		if (filter === "public") {
			filtered = filtered.filter((prompt: Prompt) => prompt.public);
		} else if (filter === "mine") {
			filtered = filtered.filter((prompt: Prompt) => !prompt.public);
		}

		return filtered;
	}, [prompts, searchQuery, filter]);

	const handleSelect = () => {
		if (selectedPrompt) {
			onSelect(selectedPrompt);
			onClose();
			setSelectedPrompt(null);
			setSearchQuery("");
		}
	};

	const handleClose = () => {
		onClose();
		setSelectedPrompt(null);
		setSearchQuery("");
	};

	const formatDate = (dateString?: string) => {
		if (!dateString) return "No date";
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Select Prompt
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 flex-1 min-h-0 flex flex-col">
					{/* Search */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search prompts by name or content..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
						/>
					</div>

					{/* Filter tabs */}
					<div className="flex gap-2">
						<Button
							variant={filter === "all" ? "default" : "outline"}
							size="sm"
							onClick={() => setFilter("all")}
						>
							All Prompts
						</Button>
						<Button
							variant={filter === "mine" ? "default" : "outline"}
							size="sm"
							onClick={() => setFilter("mine")}
						>
							My Prompts
						</Button>
						<Button
							variant={filter === "public" ? "default" : "outline"}
							size="sm"
							onClick={() => setFilter("public")}
						>
							Public
						</Button>
					</div>

					{/* Results count */}
					<p className="text-sm text-muted-foreground">
						{filteredPrompts.length} prompts found
					</p>

					{/* Prompt list */}
					<ScrollArea className="flex-1 min-h-0">
						<div className="space-y-2 pr-4">
							{isLoading ? (
								<div className="text-center py-8">
									<p className="text-muted-foreground">Loading prompts...</p>
								</div>
							) : filteredPrompts.length > 0 ? (
								filteredPrompts.map((prompt) => (
									<div
										key={prompt.id}
										className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
											selectedPrompt?.id === prompt.id
												? "bg-primary/10 border-primary"
												: "hover:bg-muted"
										}`}
										onClick={() => setSelectedPrompt(prompt)}
									>
										<div className="flex items-start justify-between mb-2">
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-1">
													<h4 className="font-semibold text-base">
														{prompt.name}
													</h4>
													<Badge variant="outline" className="text-xs">
														v{prompt.v}
													</Badge>
												</div>
												<p className="text-sm text-muted-foreground line-clamp-2">
													{prompt.content}
												</p>
											</div>
										</div>
										<div className="flex items-center justify-between mt-3">
											<Badge
												variant={prompt.public ? "default" : "secondary"}
												className="text-xs gap-1"
											>
												{prompt.public ? (
													<>
														<Globe className="h-3 w-3" />
														Public
													</>
												) : (
													<>
														<Lock className="h-3 w-3" />
														Private
													</>
												)}
											</Badge>
											<span className="text-xs text-muted-foreground">
												Updated {formatDate(prompt.updated_at)}
											</span>
										</div>
									</div>
								))
							) : (
								<div className="text-center py-8">
									<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<p className="text-muted-foreground">
										{searchQuery
											? `No prompts match "${searchQuery}"`
											: "No prompts available"}
									</p>
								</div>
							)}
						</div>
					</ScrollArea>
				</div>

				{/* Footer */}
				<div className="flex justify-between items-center pt-4 border-t">
					<p className="text-sm text-muted-foreground">
						{selectedPrompt
							? `Selected: ${selectedPrompt.name} (v${selectedPrompt.v})`
							: "Select a prompt to continue"}
					</p>
					<div className="flex gap-2">
						<Button variant="outline" onClick={handleClose}>
							Cancel
						</Button>
						<Button onClick={handleSelect} disabled={!selectedPrompt}>
							Use Selected Prompt
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
