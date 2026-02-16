import React, { useEffect, useState } from "react";
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
	DialogTrigger,
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
import { useAgentCrons } from "@/hooks/useAgentCrons";
import { Agent } from "@/lib/services/agentService";
import { Cron, CronCreate } from "@/lib/entities/cron";
import { getCronStatus } from "@/lib/utils/cron";
import {
	Plus,
	Search,
	Calendar,
	Clock,
	AlertCircle,
	Filter,
	Bot,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DialogDescription } from "@/components/ui/dialog";

interface AgentCronsPanelProps {
	agent: Agent;
}

type FilterStatus = "all" | "active" | "upcoming" | "overdue";
type SortBy = "next_run" | "created" | "name";

export const AgentCronsPanel: React.FC<AgentCronsPanelProps> = ({
	agent,
}) => {
	const {
		crons,
		loading,
		fetchCrons,
		createCron,
		updateCron,
		deleteCron,
		getCron,
	} = useAgentCrons(agent.id);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [editingSchedule, setEditingSchedule] = useState<Cron | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
	const [sortBy, setSortBy] = useState<SortBy>("next_run");

	useEffect(() => {
		if (agent.id) {
			fetchCrons();
		}
	}, [agent.id, fetchCrons]);

	const handleCreateSchedule = async (scheduleData: CronCreate) => {
		try {
			await createCron(scheduleData);
			setShowCreateDialog(false);
			toast.success("Schedule created successfully!");
		} catch (error) {
			console.error("Failed to create schedule:", error);
			toast.error("Failed to create schedule");
		}
	};

	const handleEditSchedule = async (scheduleId: string) => {
		try {
			const schedule = await getCron(scheduleId);
			setEditingSchedule(schedule);
			setShowEditDialog(true);
		} catch (error) {
			console.error("Failed to fetch schedule for editing:", error);
			toast.error("Failed to load schedule for editing");
		}
	};

	const handleUpdateSchedule = async (scheduleData: CronCreate) => {
		if (!editingSchedule) return;

		try {
			await updateCron(editingSchedule.id, scheduleData);
			setShowEditDialog(false);
			setEditingSchedule(null);
			toast.success("Schedule updated successfully!");
		} catch (error) {
			console.error("Failed to update schedule:", error);
			toast.error("Failed to update schedule");
		}
	};

	const handleDeleteSchedule = async (scheduleId: string) => {
		if (window.confirm("Are you sure you want to delete this schedule?")) {
			try {
				await deleteCron(scheduleId);
				toast.success("Schedule deleted successfully!");
			} catch (error) {
				console.error("Failed to delete schedule:", error);
				toast.error("Failed to delete schedule");
			}
		}
	};

	const handleDuplicateSchedule = () => {
		// TODO: Implement duplicate functionality
		toast.info("Duplicate functionality coming soon!");
	};

	const filteredAndSortedSchedules = crons
		.filter((schedule) => {
			// Search filter
			const matchesSearch =
				searchQuery === "" ||
				schedule.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				schedule.task.input?.messages?.[0]?.content
					?.toLowerCase()
					.includes(searchQuery.toLowerCase());

			// Status filter
			if (filterStatus === "all") return matchesSearch;
			return (
				matchesSearch && getCronStatus(schedule.next_run_time) === filterStatus
			);
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

	const getStatusCounts = () => {
		const counts = {
			all: crons.length,
			active: 0,
			upcoming: 0,
			overdue: 0,
		};
		crons.forEach((schedule) => {
			const status = getCronStatus(schedule.next_run_time);
			counts[status]++;
		});
		return counts;
	};

	const statusCounts = getStatusCounts();

	if (loading && crons.length === 0) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-center">
					<Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
					<p className="text-muted-foreground">Loading schedules...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Schedules</h2>
					<div className="flex items-center gap-2 mt-1">
						<p className="text-sm text-muted-foreground">Automated tasks for</p>
						<Badge variant="secondary" className="gap-1.5">
							<Bot className="h-3 w-3" />
							<span className="font-medium">{agent.name}</span>
						</Badge>
					</div>
				</div>
				<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							Create Schedule
						</Button>
					</DialogTrigger>
					<DialogContent className="max-h-[99vh] max-w-[99vw] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Create Automated Schedule</DialogTitle>
							<DialogDescription>
								Configure when and what tasks should run automatically
							</DialogDescription>
						</DialogHeader>
						<AgentCronForm
							agent={agent}
							onSubmit={handleCreateSchedule}
							onCancel={() => setShowCreateDialog(false)}
							isLoading={loading}
						/>
					</DialogContent>
				</Dialog>

				{/* Edit Dialog */}
				<Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
					<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Edit Schedule: {editingSchedule?.title}</DialogTitle>
							<DialogDescription className="flex items-center gap-2 mt-2">
								<Badge variant="secondary" className="gap-1">
									<Bot className="h-3 w-3" />
									{agent.name}
								</Badge>
								<span className="text-muted-foreground">•</span>
								<span className="text-sm">
									{editingSchedule?.trigger.expression}
								</span>
							</DialogDescription>
						</DialogHeader>
						{editingSchedule && (
							<AgentCronForm
								agent={agent}
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
									message:
										editingSchedule.task.input?.messages?.[0]?.content || "",
									inheritFromAgent:
										editingSchedule.task.metadata?.inherited_from_agent ?? true,
									customModel: editingSchedule.task.model,
									customSystem: editingSchedule.task.system_prompt,
									customTools: editingSchedule.task.tools || [],
								}}
								isLoading={loading}
							/>
						)}
					</DialogContent>
				</Dialog>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
								<p className="text-2xl font-bold">{statusCounts.active}</p>
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
								<p className="text-2xl font-bold">{statusCounts.upcoming}</p>
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
								<p className="text-2xl font-bold">{statusCounts.overdue}</p>
								<p className="text-xs text-muted-foreground">Overdue</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters and Search */}
			<div className="flex flex-col sm:flex-row gap-4">
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
						value={filterStatus}
						onValueChange={(value: FilterStatus) => setFilterStatus(value)}
					>
						<SelectTrigger className="w-[140px]">
							<Filter className="h-4 w-4 mr-2" />
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All ({statusCounts.all})</SelectItem>
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

			{/* Schedules Grid */}
			{filteredAndSortedSchedules.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredAndSortedSchedules.map((schedule) => (
						<AgentCronCard
							key={schedule.id}
							schedule={schedule}
							agent={agent}
							onEdit={handleEditSchedule}
							onDelete={handleDeleteSchedule}
							onDuplicate={handleDuplicateSchedule}
						/>
					))}
				</div>
			) : (
				/* Empty State */
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Calendar className="h-12 w-12 text-muted-foreground mb-4" />
						<CardTitle className="text-lg mb-2">
							{searchQuery || filterStatus !== "all"
								? "No schedules found"
								: "No schedules yet"}
						</CardTitle>
						<CardDescription className="text-center mb-4">
							{searchQuery || filterStatus !== "all"
								? "Try adjusting your search or filter criteria"
								: `Create your first automated schedule for ${agent.name} to get started`}
						</CardDescription>
						{!searchQuery && filterStatus === "all" && (
							<Button onClick={() => setShowCreateDialog(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Create First Schedule
							</Button>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
};
