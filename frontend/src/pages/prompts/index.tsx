import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import HouseIcon from "@/components/icons/HouseIcon";
import { Plus, Search, FileText } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePromptContext } from "@/context/PromptContext";
import { Prompt } from "@/lib/entities/prompt";
import { PromptCard } from "@/components/cards/PromptCard";

type FilterType = "all" | "mine" | "public";

function PromptsIndexPage() {
	const navigate = useNavigate();
	const { prompts, isLoading } = usePromptContext();
	const [, setSearchParams] = useSearchParams();
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<FilterType>("all");

	useEffect(() => {
		setSearchParams(new URLSearchParams());
	}, []);

	// Filter and search prompts
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

	const handlePromptClick = (promptId: string) => {
		navigate(`/prompts/${promptId}/edit`);
	};

	return (
		<div className="h-screen flex flex-col">
			{/* Header with navigation and actions */}
			<div className="absolute top-4 right-4 z-10">
				<div className="flex flex-row gap-2 items-center">
					<MainToolTip content="New Prompt" delayDuration={500}>
						<Button
							variant="outline"
							size="icon"
							onClick={() => navigate("/prompts/create")}
						>
							<Plus className="h-4 w-4" />
						</Button>
					</MainToolTip>
					<ColorModeButton />
				</div>
			</div>
			<div className="absolute top-4 left-4 z-10">
				<div className="flex flex-row gap-2 items-center">
					<Button variant="outline" size="icon" onClick={() => navigate("/")}>
						<HouseIcon />
					</Button>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 flex flex-col min-h-0 pt-16">
				{/* Fixed header section */}
				<div className="flex-shrink-0 px-4">
					<div className="mx-auto">
						{/* Page title and search */}
						<div className="mb-5">
							<h1 className="text-3xl font-bold text-foreground mb-2">
								Prompts
							</h1>
							<p className="text-muted-foreground mb-6">
								Discover and reuse system prompts for your agents
							</p>

							{/* Search bar */}
							<div className="relative max-w-md mb-4">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									type="text"
									placeholder="Search prompts by name or content..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-10"
								/>
							</div>

							{/* Filter buttons */}
							<div className="flex gap-2 mb-4">
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
						</div>

						{/* Results summary */}
						<div className="mb-6">
							<p className="text-sm text-muted-foreground">
								{filteredPrompts.length === prompts.length
									? `Showing all ${filteredPrompts.length} prompts`
									: `Found ${filteredPrompts.length} prompts`}
								{searchQuery && ` matching "${searchQuery}"`}
							</p>
						</div>
					</div>
				</div>

				{/* Scrollable content area */}
				<div className="flex-1 min-h-0 px-4">
					<div className="mx-auto h-full">
						<ScrollArea className="h-full">
							<div className="pb-4">
								{/* Loading state */}
								{isLoading ? (
									<div className="text-center py-12">
										<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
										<h3 className="text-lg font-semibold text-foreground mb-2">
											Loading prompts...
										</h3>
									</div>
								) : filteredPrompts.length > 0 ? (
									/* Prompt cards grid */
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-8">
										{filteredPrompts.map((prompt: Prompt) => (
											<PromptCard
												key={prompt.id}
												prompt={prompt}
												onClick={() => handlePromptClick(prompt.id || "")}
											/>
										))}
									</div>
								) : (
									/* Empty state */
									<div className="text-center py-12">
										<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
										<h3 className="text-lg font-semibold text-foreground mb-2">
											No prompts found
										</h3>
										<p className="text-muted-foreground mb-4">
											{searchQuery
												? `No prompts match your search for "${searchQuery}"`
												: filter === "mine"
													? "You haven't created any private prompts yet"
													: filter === "public"
														? "No public prompts available"
														: "No prompts available at the moment"}
										</p>
										<div className="flex gap-2 justify-center">
											{searchQuery && (
												<Button
													variant="outline"
													onClick={() => setSearchQuery("")}
												>
													Clear search
												</Button>
											)}
											<Button onClick={() => navigate("/prompts/create")}>
												<Plus className="h-4 w-4 mr-2" />
												Create Prompt
											</Button>
										</div>
									</div>
								)}
							</div>
						</ScrollArea>
					</div>
				</div>
			</div>
		</div>
	);
}

export default PromptsIndexPage;
