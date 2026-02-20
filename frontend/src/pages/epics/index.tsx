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
import { Badge } from "@/components/ui/badge";
import {
	Plus,
	Search,
	FolderKanban,
	Trash2,
	Loader2,
	ListChecks,
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEpicContext } from "@/context/EpicContext";
import { Epic } from "@/lib/entities/epic";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CreateEpicModal } from "@/components/modals/CreateEpicModal";
import { useNavigate } from "react-router-dom";
import EpicService from "@/lib/services/epicService";

function EpicIndexPage() {
	const navigate = useNavigate();
	const { epics, loading, useEffectGetEpics, handleDeleteEpic } =
		useEpicContext();
	const [searchQuery, setSearchQuery] = useState("");
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

	useEffectGetEpics();

	// Fetch task counts for all epics
	const fetchTaskCounts = useCallback(async () => {
		const counts: Record<string, number> = {};
		await Promise.all(
			epics.map(async (epic) => {
				if (!epic.id) return;
				try {
					const response = await EpicService.listTasks(epic.id);
					counts[epic.id] = (response.data.tasks || []).length;
				} catch {
					counts[epic.id!] = 0;
				}
			}),
		);
		setTaskCounts(counts);
	}, [epics]);

	useEffect(() => {
		if (epics.length > 0) {
			fetchTaskCounts();
		}
	}, [epics, fetchTaskCounts]);

	const filteredEpics = useMemo(() => {
		if (!searchQuery.trim()) return epics;
		return epics.filter(
			(epic: Epic) =>
				epic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				epic.description?.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [epics, searchQuery]);

	const handleDelete = async (epicId: string) => {
		if (
			window.confirm(
				"Are you sure you want to delete this epic? All associated tasks will also be deleted.",
			)
		) {
			await handleDeleteEpic(epicId);
		}
	};

	const getStatusColor = (status?: string) => {
		switch (status) {
			case "active":
				return "default";
			case "completed":
				return "secondary";
			case "archived":
				return "outline";
			default:
				return "default";
		}
	};

	const getResultsSummary = () => {
		if (loading) return "Loading epics...";
		return filteredEpics.length === epics.length
			? `Showing all ${filteredEpics.length} epics`
			: `Found ${filteredEpics.length} epics matching "${searchQuery}"`;
	};

	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<ChatNav sidebarTrigger={<SidebarTrigger />} />
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					{/* Fixed header section */}
					<div className="flex-shrink-0 px-4 pt-4">
						<div className="mx-auto">
							<div className="mb-5">
								<div className="flex items-center justify-between mb-2">
									<h1 className="text-3xl font-bold text-foreground">Epics</h1>
									<MainToolTip content="New Epic" delayDuration={500}>
										<Button
											variant="outline"
											size="icon"
											onClick={() => setIsCreateModalOpen(true)}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</MainToolTip>
								</div>
								<p className="text-muted-foreground mb-6">
									Organize and track your work with epics and tasks
								</p>

								<div className="relative max-w-md">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										type="text"
										placeholder="Search epics..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-10"
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Content */}
					<div className="flex-1 min-h-0 px-4 pb-4">
						<div className="mx-auto h-full flex flex-col">
							<div className="flex items-center justify-between mb-4">
								<p className="text-sm text-muted-foreground">
									{getResultsSummary()}
								</p>
							</div>

							<ScrollArea className="h-full">
								<div className="pb-4">
									{loading ? (
										<div className="flex items-center justify-center py-12">
											<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
											<span className="ml-3 text-muted-foreground">
												Loading epics...
											</span>
										</div>
									) : filteredEpics.length > 0 ? (
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-8">
											{filteredEpics.map((epic: Epic) => (
												<Card
													key={epic.id}
													className="hover:shadow-lg transition-shadow duration-200 group cursor-pointer"
													onClick={() => navigate(`/epics/${epic.id}`)}
												>
													<CardHeader className="pb-3">
														<div className="flex items-start justify-between">
															<FolderKanban className="h-5 w-5 text-primary flex-shrink-0" />
															<div className="flex items-center gap-2">
																<Badge variant={getStatusColor(epic.status)}>
																	{epic.status || "active"}
																</Badge>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
																	onClick={(e) => {
																		e.stopPropagation();
																		if (epic.id) handleDelete(epic.id);
																	}}
																	title="Delete epic"
																>
																	<Trash2 className="h-3 w-3 text-red-400" />
																</Button>
															</div>
														</div>
														<CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-2">
															{epic.name}
														</CardTitle>
														<CardDescription className="text-xs line-clamp-3">
															{epic.description || "No description"}
														</CardDescription>
													</CardHeader>
													<CardContent className="pt-0">
														<div className="flex items-center gap-2 text-xs text-muted-foreground">
															<ListChecks className="h-3 w-3" />
															<span>
																{epic.id && taskCounts[epic.id] !== undefined
																	? `${taskCounts[epic.id]} task${taskCounts[epic.id] !== 1 ? "s" : ""}`
																	: "Loading..."}
															</span>
														</div>
													</CardContent>
												</Card>
											))}
										</div>
									) : (
										<div className="text-center py-12">
											<FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
											<h3 className="text-lg font-semibold text-foreground mb-2">
												No epics found
											</h3>
											<p className="text-muted-foreground mb-4">
												{searchQuery
													? `No epics match your search for "${searchQuery}"`
													: "You haven't created any epics yet"}
											</p>
											{searchQuery ? (
												<Button
													variant="outline"
													onClick={() => setSearchQuery("")}
												>
													Clear search
												</Button>
											) : (
												<Button onClick={() => setIsCreateModalOpen(true)}>
													<Plus className="h-4 w-4 mr-2" />
													Create your first epic
												</Button>
											)}
										</div>
									)}
								</div>
							</ScrollArea>
						</div>
					</div>
				</div>
			</div>

			<CreateEpicModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
			/>
		</ChatLayout>
	);
}

export default EpicIndexPage;
