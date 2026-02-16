import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { AgentCronCard } from "@/components/cards/AgentCronCard";
import { AgentCronForm } from "@/components/forms/AgentCronForm";
import { CronCalendar } from "@/components/calendar/CronCalendar";
import { CronTable } from "@/components/tables/CronTable";
import { ViewToggle } from "@/components/toggles/ViewToggle";
import { getCronStatus } from "@/lib/utils/cron";
import {
	mapExecutionsToEvents,
	mapCronsToProjectedEvents,
	mergeAndDeduplicateEvents,
} from "@/lib/utils/calendar";
import {
	Search,
	Calendar,
	Clock,
	AlertCircle,
	Filter,
	Bot,
	Plus,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { MainToolTip } from "@/components/tooltips/MainToolTip";
import HouseIcon from "@/components/icons/HouseIcon";
import { useCrons } from "@/hooks/useCrons";
import { useCronExecutions } from "@/hooks/useCronExecutions";
import { useAgentContext } from "@/context/AgentContext";
import { Cron, CronCreate, CronEvent } from "@/lib/entities/cron";
import { toast } from "sonner";

type FilterStatus = "all" | "active" | "upcoming" | "overdue";
type SortBy = "next_run" | "created" | "name";

function CronsIndexPage() {
	const navigate = useNavigate();
	const [, setSearchParams] = useSearchParams();
	const {
		crons,
		loading,
		fetchCrons,
		deleteCron,
		createCron,
		updateCron,
		getCron,
	} = useCrons();
	const { agents, useEffectGetAgents } = useAgentContext();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
	const [sortBy, setSortBy] = useState<SortBy>("next_run");
	const [filterAgentId, setFilterAgentId] = useState<string>("all");
	const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar");
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [selectedAgentId, setSelectedAgentId] = useState<string>("");
	const [editingCron, setEditingCron] = useState<Cron | null>(null);

	const { executions } = useCronExecutions();

	// Map executions to calendar events
	const cronsMap = useMemo(() => {
		const map = new Map<string, Cron>();
		for (const s of crons) {
			map.set(s.id, s);
		}
		return map;
	}, [crons]);

	const handleEventClick = (event: CronEvent) => {
		if (event.resource.thread_id) {
			window.open(
				`/?t=${event.resource.thread_id}`,
				"_blank",
				"noopener,noreferrer",
			);
		} else if (event.id.startsWith("projected-")) {
			// Projected events have no thread — open the edit dialog instead
			const cronId = event.resource.cron_id;
			handleEditCron(cronId);
		}
	};

	useEffectGetAgents();

	useEffect(() => {
		setSearchParams(new URLSearchParams());
	}, []);

	useEffect(() => {
		fetchCrons();
	}, [fetchCrons]);

	const handleCreateCron = async (cronData: CronCreate) => {
		try {
			const agent = agents.find((a: any) => a.id === selectedAgentId);
			if (!agent) {
				toast.error("Agent not found");
				return;
			}

			// Add agent_id to metadata
			const enhancedCron: CronCreate = {
				...cronData,
				task: {
					...cronData.task,
					metadata: {
						...cronData.task.metadata,
						agent_id: selectedAgentId,
					},
				},
			};

			await createCron(enhancedCron);
			setShowCreateDialog(false);
			setSelectedAgentId("");
			toast.success("Cron created successfully!");
		} catch (error) {
			console.error("Failed to create cron:", error);
			toast.error("Failed to create cron");
		}
	};

	const handleDeleteCron = async (cronId: string) => {
		if (window.confirm("Are you sure you want to delete this cron?")) {
			await deleteCron(cronId);
		}
	};

	const handleEditCron = async (cronId: string) => {
		try {
			const cron = await getCron(cronId);
			setEditingCron(cron);
			setShowEditDialog(true);
		} catch (error) {
			console.error("Failed to fetch cron for editing:", error);
			toast.error("Failed to load cron for editing");
		}
	};

	const handleUpdateCron = async (cronData: CronCreate) => {
		if (!editingCron) return;

		try {
			await updateCron(editingCron.id, cronData);
			setShowEditDialog(false);
			setEditingCron(null);
			toast.success("Cron updated successfully!");
		} catch (error) {
			console.error("Failed to update cron:", error);
			toast.error("Failed to update cron");
		}
	};

	const handleDuplicateCron = () => {
		// TODO: Implement duplicate functionality
		toast.info("Duplicate functionality coming soon!");
	};

	const filteredAndSortedCrons = useMemo(() => {
		return crons
			.filter((cron) => {
				// Search filter
				const matchesSearch =
					searchQuery === "" ||
					cron.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					cron.task.input?.messages?.[0]?.content
						?.toLowerCase()
						.includes(searchQuery.toLowerCase());

				// Status filter
				const matchesStatus =
					filterStatus === "all" ||
					getCronStatus(cron.next_run_time) === filterStatus;

				// Agent filter
				const matchesAgent =
					filterAgentId === "all" ||
					cron.task?.metadata?.agent_id === filterAgentId;

				return matchesSearch && matchesStatus && matchesAgent;
			})
			.sort((a, b) => {
				switch (sortBy) {
					case "next_run":
						return (
							new Date(a.next_run_time).getTime() -
							new Date(b.next_run_time).getTime()
						);
					case "created":
						// Fallback to ID if no created date
						return a.id.localeCompare(b.id);
					case "name": {
						const nameA = a.title || "";
						const nameB = b.title || "";
						return nameA.localeCompare(nameB);
					}
					default:
						return 0;
				}
			});
	}, [crons, searchQuery, filterStatus, filterAgentId, sortBy]);

	// Create a set of filtered cron IDs to filter executions
	const filteredCronIds = useMemo(() => {
		return new Set(filteredAndSortedCrons.map((s) => s.id));
	}, [filteredAndSortedCrons]);

	// Filter executions to only include those for filtered crons
	const filteredExecutions = useMemo(() => {
		if (!executions) return [];
		return executions.filter((e) => filteredCronIds.has(e.cron_id));
	}, [executions, filteredCronIds]);

	// Create filtered calendar events for calendar/table views
	// Merge execution-based events with projected events from cron definitions
	// so crons always appear even when they have no executions yet
	const filteredCalendarEvents = useMemo(() => {
		const executionEvents = mapExecutionsToEvents(
			filteredExecutions,
			cronsMap,
		);
		const projectedEvents = mapCronsToProjectedEvents(
			filteredAndSortedCrons,
		);
		return mergeAndDeduplicateEvents(executionEvents, projectedEvents);
	}, [filteredExecutions, cronsMap, filteredAndSortedCrons]);

	const getStatusCounts = () => {
		const counts = {
			all: crons.length,
			active: 0,
			upcoming: 0,
			overdue: 0,
		};
		crons.forEach((cron) => {
			const status = getCronStatus(cron.next_run_time);
			counts[status]++;
		});
		return counts;
	};

	const statusCounts = getStatusCounts();

	// Get agent for a cron
	const getAgentForCron = (cron: Cron) => {
		const agentId = cron.task?.metadata?.agent_id;
		return agents.find((a: any) => a.id === agentId);
	};

	if (loading && crons.length === 0) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-center">
					<Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
					<p className="text-muted-foreground">Loading crons...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col">
			{/* Header with navigation and actions */}
			<div className="absolute top-4 right-4 z-10">
				<div className="flex flex-row gap-2 items-center">
					<MainToolTip content="Create Cron" delayDuration={500}>
						<Button
							variant="outline"
							size="icon"
							onClick={() => setShowCreateDialog(true)}
						>
							<Plus />
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
					<MainToolTip content="Agents" delayDuration={500}>
						<Button
							variant="outline"
							size="icon"
							onClick={() => navigate("/assistants")}
						>
							<Bot />
						</Button>
					</MainToolTip>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 flex flex-col min-h-0 pt-14">
				{/* Fixed header section */}
				<div className="flex-shrink-0 px-4">
					<div className="mx-auto">
						{/* Page title */}
						<div className="mb-3 md:mb-5">
							<h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">
								Crons
							</h1>
							<p className="text-sm md:text-base text-muted-foreground mb-3 md:mb-6">
								Manage all your automated agent crons
							</p>
						</div>

						{/* Stats Cards */}
						<div className="grid grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-6">
							<Card>
								<CardContent className="p-2 md:p-4">
									<div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
										<Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
										<div className="text-center md:text-left">
											<p className="text-sm md:text-2xl font-bold">
												{statusCounts.all}
											</p>
											<p className="text-[9px] md:text-xs text-muted-foreground whitespace-nowrap">
												Total
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="p-2 md:p-4">
									<div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
										<Clock className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
										<div className="text-center md:text-left">
											<p className="text-sm md:text-2xl font-bold">
												{statusCounts.active}
											</p>
											<p className="text-[9px] md:text-xs text-muted-foreground whitespace-nowrap">
												Active
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="p-2 md:p-4">
									<div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
										<Clock className="h-3 w-3 md:h-4 md:w-4 text-orange-500" />
										<div className="text-center md:text-left">
											<p className="text-sm md:text-2xl font-bold">
												{statusCounts.upcoming}
											</p>
											<p className="text-[9px] md:text-xs text-muted-foreground whitespace-nowrap">
												Upcoming
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="p-2 md:p-4">
									<div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
										<AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
										<div className="text-center md:text-left">
											<p className="text-sm md:text-2xl font-bold">
												{statusCounts.overdue}
											</p>
											<p className="text-[9px] md:text-xs text-muted-foreground whitespace-nowrap">
												Overdue
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Filters and Search */}
						<div className="flex flex-col sm:flex-row gap-2 md:gap-4 mb-3 md:mb-6">
							<div className="flex-1">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search crons..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-10 h-9 md:h-10"
									/>
								</div>
							</div>
							<div className="flex gap-2">
								<ViewToggle view={viewMode} onViewChange={setViewMode} />
								<Select
									value={filterAgentId}
									onValueChange={(value: string) => setFilterAgentId(value)}
								>
									<SelectTrigger className="w-[120px] md:w-[160px] h-9 md:h-10">
										<Bot className="h-4 w-4 mr-2" />
										<SelectValue placeholder="All Agents" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Agents</SelectItem>
										{agents.map((agent: any) => (
											<SelectItem key={agent.id} value={agent.id || ""}>
												{agent.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={filterStatus}
									onValueChange={(value: FilterStatus) =>
										setFilterStatus(value)
									}
								>
									<SelectTrigger className="w-[100px] md:w-[140px] h-9 md:h-10">
										<Filter className="h-4 w-4 mr-2" />
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											All ({statusCounts.all})
										</SelectItem>
										<SelectItem value="active">
											Active ({statusCounts.active})
										</SelectItem>
										<SelectItem value="upcoming">
											Upcoming ({statusCounts.upcoming})
										</SelectItem>
										<SelectItem value="overdue">
											Overdue ({statusCounts.overdue})
										</SelectItem>
									</SelectContent>
								</Select>
								<Select
									value={sortBy}
									onValueChange={(value: SortBy) => setSortBy(value)}
								>
									<SelectTrigger className="w-[100px] md:w-[140px] h-9 md:h-10">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="next_run">Next Run</SelectItem>
										<SelectItem value="created">Created</SelectItem>
										<SelectItem value="name">Name</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				</div>

				{/* Scrollable content area */}
				<div className="flex-1 min-h-0 px-4 overflow-auto">
					<div className="mx-auto h-full">
						{viewMode === "calendar" ? (
							<CronCalendar
								events={filteredCalendarEvents}
								onEventClick={handleEventClick}
							/>
						) : viewMode === "table" ? (
							<CronTable
								events={filteredCalendarEvents}
								onEdit={handleEditCron}
								onDelete={handleDeleteCron}
								onDuplicate={handleDuplicateCron}
							/>
						) : (
							<ScrollArea className="h-full">
								<div className="pb-4">
									{/* Crons Grid */}
									{filteredAndSortedCrons.length > 0 ? (
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
											{filteredAndSortedCrons.map((cron) => {
												const agent = getAgentForCron(cron);
												return (
													<AgentCronCard
														key={cron.id}
														schedule={cron}
														agent={agent || { id: "", name: "Unknown Agent" }}
														onEdit={handleEditCron}
														onDelete={handleDeleteCron}
														onDuplicate={handleDuplicateCron}
													/>
												);
											})}
										</div>
									) : (
										/* Empty State */
										<Card>
											<CardContent className="flex flex-col items-center justify-center py-12">
												<Calendar className="h-12 w-12 text-muted-foreground mb-4" />
												<CardTitle className="text-lg mb-2">
													{searchQuery ||
													filterStatus !== "all" ||
													filterAgentId !== "all"
														? "No crons found"
														: "No crons yet"}
												</CardTitle>
												<CardDescription className="text-center mb-4">
													{searchQuery ||
													filterStatus !== "all" ||
													filterAgentId !== "all"
														? "Try adjusting your search or filter criteria"
														: "Create crons from agent pages to get started"}
												</CardDescription>
												{!searchQuery &&
													filterStatus === "all" &&
													filterAgentId === "all" && (
														<Button onClick={() => navigate("/assistants")}>
															<Bot className="h-4 w-4 mr-2" />
															Go to Agents
														</Button>
													)}
											</CardContent>
										</Card>
									)}
								</div>
							</ScrollArea>
						)}
					</div>
				</div>
			</div>

			{/* Create Cron Dialog with Agent Selection */}
			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent className="max-h-[98vh] max-w-[98vw] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Create New Cron</DialogTitle>
					</DialogHeader>
					{!selectedAgentId ? (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Select an agent to create a cron for:
							</p>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
								{agents.map((agent: any) => (
									<Card
										key={agent.id}
										className="cursor-pointer hover:bg-accent transition-colors"
										onClick={() => setSelectedAgentId(agent.id)}
									>
										<CardContent className="p-4">
											<div className="flex items-start gap-3">
												<Bot className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
												<div className="flex-1 min-w-0">
													<p className="font-medium truncate">{agent.name}</p>
													<p className="text-sm text-muted-foreground truncate">
														{agent.description || "No description"}
													</p>
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</div>
					) : (
						<AgentCronForm
							agent={agents.find((a: any) => a.id === selectedAgentId)}
							onSubmit={handleCreateCron}
							onCancel={() => {
								setShowCreateDialog(false);
								setSelectedAgentId("");
							}}
							isLoading={loading}
						/>
					)}
				</DialogContent>
			</Dialog>

			{/* Edit Cron Dialog */}
			<Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
				<DialogContent className="max-h-[99vh] max-w-[99vw] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Cron</DialogTitle>
					</DialogHeader>
					{editingCron && (
						<AgentCronForm
							agent={
								getAgentForCron(editingCron) || {
									id: "",
									name: "Unknown Agent",
								}
							}
							onSubmit={handleUpdateCron}
							onCancel={() => {
								setShowEditDialog(false);
								setEditingCron(null);
							}}
							initialData={{
								name: editingCron.title || "",
								description:
									editingCron.task.metadata?.schedule_description || "",
								enabled: editingCron.task.metadata?.enabled ?? true,
								cronExpression: editingCron.trigger.expression,
								message:
									editingCron.task.input?.messages?.[0]?.content || "",
								inheritFromAgent:
									editingCron.task.metadata?.inherited_from_agent ?? true,
								customModel: editingCron.task.model,
								customSystem: editingCron.task.system_prompt,
								customTools: editingCron.task.tools || [],
							}}
							isLoading={loading}
						/>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default CronsIndexPage;
