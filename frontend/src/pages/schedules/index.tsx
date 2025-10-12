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
import { AgentScheduleCard } from "@/components/cards/AgentScheduleCard";
import { AgentScheduleForm } from "@/components/forms/AgentScheduleForm";
import { getScheduleStatus } from "@/lib/utils/schedule";
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
import { useSchedules } from "@/hooks/useSchedules";
import { useAgentContext } from "@/context/AgentContext";
import { Schedule, ScheduleCreate } from "@/lib/entities/schedule";
import { toast } from "sonner";

type FilterStatus = "all" | "active" | "upcoming" | "overdue";
type SortBy = "next_run" | "created" | "name";

function SchedulesIndexPage() {
	const navigate = useNavigate();
	const [, setSearchParams] = useSearchParams();
	const {
		schedules,
		loading,
		fetchSchedules,
		deleteSchedule,
		createSchedule,
		updateSchedule,
		getSchedule,
	} = useSchedules();
	const { agents, useEffectGetAgents } = useAgentContext();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
	const [sortBy, setSortBy] = useState<SortBy>("next_run");
	const [filterAgentId, setFilterAgentId] = useState<string>("all");
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [selectedAgentId, setSelectedAgentId] = useState<string>("");
	const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

	useEffectGetAgents();

	useEffect(() => {
		setSearchParams(new URLSearchParams());
	}, []);

	useEffect(() => {
		fetchSchedules();
	}, [fetchSchedules]);

	const handleCreateSchedule = async (scheduleData: ScheduleCreate) => {
		try {
			const agent = agents.find((a: any) => a.id === selectedAgentId);
			if (!agent) {
				toast.error("Agent not found");
				return;
			}

			// Add agent_id to metadata
			const enhancedSchedule: ScheduleCreate = {
				...scheduleData,
				task: {
					...scheduleData.task,
					metadata: {
						...scheduleData.task.metadata,
						agent_id: selectedAgentId,
					},
				},
			};

			await createSchedule(enhancedSchedule);
			setShowCreateDialog(false);
			setSelectedAgentId("");
			toast.success("Schedule created successfully!");
		} catch (error) {
			console.error("Failed to create schedule:", error);
			toast.error("Failed to create schedule");
		}
	};

	const handleDeleteSchedule = async (scheduleId: string) => {
		if (window.confirm("Are you sure you want to delete this schedule?")) {
			await deleteSchedule(scheduleId);
		}
	};

	const handleEditSchedule = async (scheduleId: string) => {
		try {
			const schedule = await getSchedule(scheduleId);
			setEditingSchedule(schedule);
			setShowEditDialog(true);
		} catch (error) {
			console.error("Failed to fetch schedule for editing:", error);
			toast.error("Failed to load schedule for editing");
		}
	};

	const handleUpdateSchedule = async (scheduleData: ScheduleCreate) => {
		if (!editingSchedule) return;

		try {
			await updateSchedule(editingSchedule.id, scheduleData);
			setShowEditDialog(false);
			setEditingSchedule(null);
			toast.success("Schedule updated successfully!");
		} catch (error) {
			console.error("Failed to update schedule:", error);
			toast.error("Failed to update schedule");
		}
	};

	const handleDuplicateSchedule = () => {
		// TODO: Implement duplicate functionality
		toast.info("Duplicate functionality coming soon!");
	};

	const filteredAndSortedSchedules = useMemo(() => {
		return schedules
			.filter((schedule) => {
				// Search filter
				const matchesSearch =
					searchQuery === "" ||
					schedule.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					schedule.task.messages?.[0]?.content
						?.toLowerCase()
						.includes(searchQuery.toLowerCase());

				// Status filter
				const matchesStatus =
					filterStatus === "all" ||
					getScheduleStatus(schedule.next_run_time) === filterStatus;

				// Agent filter
				const matchesAgent =
					filterAgentId === "all" ||
					schedule.task?.metadata?.agent_id === filterAgentId;

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
	}, [schedules, searchQuery, filterStatus, filterAgentId, sortBy]);

	const getStatusCounts = () => {
		const counts = {
			all: schedules.length,
			active: 0,
			upcoming: 0,
			overdue: 0,
		};
		schedules.forEach((schedule) => {
			const status = getScheduleStatus(schedule.next_run_time);
			counts[status]++;
		});
		return counts;
	};

	const statusCounts = getStatusCounts();

	// Get agent for a schedule
	const getAgentForSchedule = (schedule: Schedule) => {
		const agentId = schedule.task?.metadata?.agent_id;
		return agents.find((a: any) => a.id === agentId);
	};

	if (loading && schedules.length === 0) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-center">
					<Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
					<p className="text-muted-foreground">Loading schedules...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col">
			{/* Header with navigation and actions */}
			<div className="absolute top-4 right-4 z-10">
				<div className="flex flex-row gap-2 items-center">
					<MainToolTip content="Create Schedule" delayDuration={500}>
						<Button
							data-intro="create-schedule"
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
			<div className="flex-1 flex flex-col min-h-0 pt-16">
				{/* Fixed header section */}
				<div className="flex-shrink-0 px-4">
					<div className="mx-auto">
						{/* Page title */}
						<div className="mb-5" data-intro="schedules-heading">
							<h1 className="text-3xl font-bold text-foreground mb-2">
								Schedules
							</h1>
							<p className="text-muted-foreground mb-6">
								Manage all your automated agent schedules
							</p>
						</div>

						{/* Stats Cards */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-intro="stats-cards">
							<Card>
								<CardContent className="p-4">
									<div className="flex items-center gap-2">
										<Calendar className="h-4 w-4 text-muted-foreground" />
										<div>
											<p className="text-2xl font-bold">{statusCounts.all}</p>
											<p className="text-xs text-muted-foreground">Total</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="p-4">
									<div className="flex items-center gap-2">
										<Clock className="h-4 w-4 text-green-500" />
										<div>
											<p className="text-2xl font-bold">
												{statusCounts.active}
											</p>
											<p className="text-xs text-muted-foreground">Active</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="p-4">
									<div className="flex items-center gap-2">
										<Clock className="h-4 w-4 text-orange-500" />
										<div>
											<p className="text-2xl font-bold">
												{statusCounts.upcoming}
											</p>
											<p className="text-xs text-muted-foreground">Upcoming</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="p-4">
									<div className="flex items-center gap-2">
										<AlertCircle className="h-4 w-4 text-red-500" />
										<div>
											<p className="text-2xl font-bold">
												{statusCounts.overdue}
											</p>
											<p className="text-xs text-muted-foreground">Overdue</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Filters and Search */}
						<div className="flex flex-col sm:flex-row gap-4 mb-6">
							<div className="flex-1">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search schedules..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-10"
									/>
								</div>
							</div>
							<div className="flex gap-2">
								<Select
									value={filterAgentId}
									onValueChange={(value: string) => setFilterAgentId(value)}
								>
									<SelectTrigger className="w-[160px]">
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
									<SelectTrigger className="w-[140px]">
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
									<SelectTrigger className="w-[140px]">
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
				<div className="flex-1 min-h-0 px-4">
					<div className="mx-auto h-full">
						<ScrollArea className="h-full">
							<div className="pb-4">
								{/* Schedules Grid */}
								{filteredAndSortedSchedules.length > 0 ? (
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										{filteredAndSortedSchedules.map((schedule) => {
											const agent = getAgentForSchedule(schedule);
											return (
												<AgentScheduleCard
													key={schedule.id}
													schedule={schedule}
													agent={agent || { id: "", name: "Unknown Agent" }}
													onEdit={handleEditSchedule}
													onDelete={handleDeleteSchedule}
													onDuplicate={handleDuplicateSchedule}
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
													? "No schedules found"
													: "No schedules yet"}
											</CardTitle>
											<CardDescription className="text-center mb-4">
												{searchQuery ||
												filterStatus !== "all" ||
												filterAgentId !== "all"
													? "Try adjusting your search or filter criteria"
													: "Create schedules from agent pages to get started"}
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
					</div>
				</div>
			</div>

			{/* Create Schedule Dialog with Agent Selection */}
			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent className="max-h-[98vh] max-w-[98vw] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Create New Schedule</DialogTitle>
					</DialogHeader>
					{!selectedAgentId ? (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Select an agent to create a schedule for:
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
						<AgentScheduleForm
							agent={agents.find((a: any) => a.id === selectedAgentId)}
							onSubmit={handleCreateSchedule}
							onCancel={() => {
								setShowCreateDialog(false);
								setSelectedAgentId("");
							}}
							isLoading={loading}
						/>
					)}
				</DialogContent>
			</Dialog>

			{/* Edit Schedule Dialog */}
			<Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
				<DialogContent className="max-h-[99vh] max-w-[99vw] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Schedule</DialogTitle>
					</DialogHeader>
					{editingSchedule && (
						<AgentScheduleForm
							agent={
								getAgentForSchedule(editingSchedule) || {
									id: "",
									name: "Unknown Agent",
								}
							}
							onSubmit={handleUpdateSchedule}
							onCancel={() => {
								setShowEditDialog(false);
								setEditingSchedule(null);
							}}
							initialData={{
								name: editingSchedule.title || "",
								description:
									editingSchedule.task.metadata?.schedule_description || "",
								enabled: editingSchedule.task.metadata?.enabled ?? true,
								cronExpression: editingSchedule.trigger.expression,
								message: editingSchedule.task.messages?.[0]?.content || "",
								inheritFromAgent:
									editingSchedule.task.metadata?.inherited_from_agent || true,
								customModel: editingSchedule.task.model,
								customSystem: editingSchedule.task.system,
								customTools: editingSchedule.task.tools || [],
							}}
							isLoading={loading}
						/>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default SchedulesIndexPage;
