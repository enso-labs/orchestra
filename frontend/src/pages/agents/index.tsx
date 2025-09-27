import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import HouseIcon from "@/components/icons/HouseIcon";
import {
	Plus,
	Search,
	ChevronLeft,
	ChevronRight,
	Computer,
	Users,
	Star,
	Calendar,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockAgents } from "@/tests/mocks/agent";

function AgentIndexPage() {
	const navigate = useNavigate();
	const [, setSearchParams] = useSearchParams();
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 24; // 6x4 grid on desktop

	useEffect(() => {
		setSearchParams(new URLSearchParams());
	}, []);

	// Filter agents based on search query
	const filteredAgents = useMemo(() => {
		if (!searchQuery.trim()) return mockAgents;
		return mockAgents.filter(
			(agent) =>
				agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				agent.categories?.some((cat) =>
					cat.toLowerCase().includes(searchQuery.toLowerCase()),
				),
		);
	}, [searchQuery]);

	// Calculate pagination
	const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const paginatedAgents = filteredAgents.slice(
		startIndex,
		startIndex + itemsPerPage,
	);

	// Reset to first page when search changes
	useEffect(() => {
		setCurrentPage(1);
	}, [searchQuery]);

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const handleAgentClick = (agentId: string) => {
		// Navigate to agent detail or chat page
		navigate(`/agents/${agentId}`);
	};

	return (
		<div className="h-screen flex flex-col">
			{/* Header with navigation and actions */}
			<div className="absolute top-4 right-4 z-10">
				<div className="flex flex-row gap-2 items-center">
					<MainToolTip content="New Agent" delayDuration={500}>
						<Button
							variant="outline"
							size="icon"
							onClick={() => navigate("/agents/create")}
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
								Enso Agents
							</h1>
							<p className="text-muted-foreground mb-6">
								Discover and deploy specialized AI agents for your workflows
							</p>

							{/* Search bar */}
							<div className="relative max-w-md">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									type="text"
									placeholder="Search agents by name, description, or category..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						{/* Results summary */}
						<div className="mb-6">
							<p className="text-sm text-muted-foreground">
								{filteredAgents.length === mockAgents.length
									? `Showing all ${filteredAgents.length} agents`
									: `Found ${filteredAgents.length} agents matching "${searchQuery}"`}
							</p>
						</div>
					</div>
				</div>

				{/* Scrollable content area */}
				<div className="flex-1 min-h-0 px-4">
					<div className=" mx-auto h-full">
						<ScrollArea className="h-full">
							<div className="pb-4">
								{/* Agent cards grid */}
								{filteredAgents.length > 0 ? (
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-8">
										{paginatedAgents.map((agent) => (
											<Card
												key={agent.id}
												className="cursor-pointer hover:shadow-lg transition-shadow duration-200 group"
												onClick={() => handleAgentClick(agent.id)}
											>
												<CardHeader className="pb-3">
													<div className="flex items-start justify-between">
														<Computer className="h-5 w-5 text-primary flex-shrink-0" />
														<div className="flex items-center gap-1 text-xs text-muted-foreground">
															<Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
															<span>{agent.rating}</span>
														</div>
													</div>
													<CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-2">
														{agent.name}
													</CardTitle>
													<CardDescription className="text-xs line-clamp-3">
														{agent.description}
													</CardDescription>
												</CardHeader>
												<CardContent className="pt-0">
													<div className="space-y-2">
														{/* Categories */}
														{agent.categories &&
															agent.categories.length > 0 && (
																<div className="flex flex-wrap gap-1">
																	{agent.categories
																		.slice(0, 2)
																		.map((category) => (
																			<span
																				key={category}
																				className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground"
																			>
																				{category}
																			</span>
																		))}
																	{agent.categories.length > 2 && (
																		<span className="text-xs text-muted-foreground">
																			+{agent.categories.length - 2}
																		</span>
																	)}
																</div>
															)}

														{/* Stats */}
														<div className="flex items-center justify-between text-xs text-muted-foreground">
															<div className="flex items-center gap-1">
																<Users className="h-3 w-3" />
																<span>
																	{agent.users?.toLocaleString() || 0}
																</span>
															</div>
															<div className="flex items-center gap-1">
																<Calendar className="h-3 w-3" />
																<span>{formatDate(agent.created_at)}</span>
															</div>
														</div>

														{/* Model info */}
														{agent.setting?.value?.model && (
															<div className="text-xs text-muted-foreground">
																Model: {agent.setting.value.model}
															</div>
														)}
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								) : (
									/* Empty state */
									<div className="text-center py-12">
										<Computer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
										<h3 className="text-lg font-semibold text-foreground mb-2">
											No agents found
										</h3>
										<p className="text-muted-foreground mb-4">
											{searchQuery
												? `No agents match your search for "${searchQuery}"`
												: "No agents available at the moment"}
										</p>
										{searchQuery && (
											<Button
												variant="outline"
												onClick={() => setSearchQuery("")}
											>
												Clear search
											</Button>
										)}
									</div>
								)}

								{/* Pagination */}
								{totalPages > 1 && (
									<div className="flex items-center justify-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												setCurrentPage((prev) => Math.max(1, prev - 1))
											}
											disabled={currentPage === 1}
										>
											<ChevronLeft className="h-4 w-4" />
											Previous
										</Button>

										<div className="flex items-center gap-1">
											{Array.from(
												{ length: Math.min(5, totalPages) },
												(_, i) => {
													let pageNum;
													if (totalPages <= 5) {
														pageNum = i + 1;
													} else if (currentPage <= 3) {
														pageNum = i + 1;
													} else if (currentPage >= totalPages - 2) {
														pageNum = totalPages - 4 + i;
													} else {
														pageNum = currentPage - 2 + i;
													}

													return (
														<Button
															key={pageNum}
															variant={
																currentPage === pageNum ? "default" : "outline"
															}
															size="sm"
															onClick={() => setCurrentPage(pageNum)}
															className="w-8 h-8 p-0"
														>
															{pageNum}
														</Button>
													);
												},
											)}
										</div>

										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												setCurrentPage((prev) => Math.min(totalPages, prev + 1))
											}
											disabled={currentPage === totalPages}
										>
											Next
											<ChevronRight className="h-4 w-4" />
										</Button>
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

export default AgentIndexPage;
