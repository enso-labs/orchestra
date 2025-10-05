import { Agent } from "@/lib/services/agentService";
import { ScheduleCreate } from "@/lib/entities/schedule";

/**
 * Helper function to create a schedule from agent configuration
 */
export const createScheduleFromAgent = (
	agent: Agent,
	cronExpression: string,
	message: string,
): ScheduleCreate => {
	return {
		trigger: {
			type: "cron",
			expression: cronExpression,
		},
		task: {
			model: agent.model,
			system: agent.prompt,
			messages: [{ role: "user", content: message }],
			tools: agent.tools,
			a2a: agent.a2a,
			mcp: agent.mcp,
			subagents: agent.subagents,
			metadata: {
				...agent.metadata,
				agent_id: agent.id,
				inherited_from_agent: true,
			},
		},
	};
};

/**
 * Validate cron expression for minimum 1-hour intervals
 */
export const validateCronExpression = (expression: string): string => {
	const parts = expression.trim().split(" ");
	if (parts.length !== 5) {
		return "Cron expression must have 5 parts (minute hour day month dayOfWeek)";
	}

	const [minute, hour] = parts;

	// Check for minimum 1-hour intervals
	if (minute === "*" || minute === "*/1") {
		return "Schedules must run at most once per hour (minute cannot be '*' or '*/1')";
	}

	if (hour === "*") {
		return "Schedules must run at most once per hour (hour cannot be '*')";
	}

	return "";
};

/**
 * Get human-readable description of cron expression
 */
export const getHumanReadableCron = (expression: string): string => {
	const [minute, hour, dayOfMonth, , dayOfWeek] = expression.split(" ");

	// Common patterns
	const patterns: Record<string, string> = {
		"0 */1 * * *": "Every hour",
		"0 */2 * * *": "Every 2 hours",
		"0 */6 * * *": "Every 6 hours",
		"0 9 * * *": "Daily at 9:00 AM",
		"0 18 * * *": "Daily at 6:00 PM",
		"0 9 * * 1": "Weekly (Monday 9 AM)",
		"0 9 1 * *": "Monthly (1st at 9 AM)",
	};

	if (patterns[expression]) {
		return patterns[expression];
	}

	// Generic parsing
	let readable = "";

	if (dayOfWeek !== "*") {
		const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		readable += `${days[parseInt(dayOfWeek)]} `;
	} else if (dayOfMonth !== "*") {
		readable += `${dayOfMonth}${getOrdinalSuffix(parseInt(dayOfMonth))} `;
	} else {
		readable += "Daily ";
	}

	if (hour !== "*") {
		const hourNum = parseInt(hour);
		const timeStr = `${hourNum.toString().padStart(2, "0")}:${minute.padStart(2, "0")}`;
		readable += `at ${timeStr}`;
	} else {
		readable += "hourly";
	}

	return readable;
};

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
export const getOrdinalSuffix = (num: number): string => {
	const j = num % 10;
	const k = num % 100;
	if (j === 1 && k !== 11) return "st";
	if (j === 2 && k !== 12) return "nd";
	if (j === 3 && k !== 13) return "rd";
	return "th";
};

/**
 * Get schedule status based on next run time
 */
export const getScheduleStatus = (
	nextRunTime: string,
): "active" | "upcoming" | "overdue" => {
	const nextRun = new Date(nextRunTime);
	const now = new Date();
	const diffHours = (nextRun.getTime() - now.getTime()) / (1000 * 60 * 60);

	if (diffHours < 0) return "overdue";
	if (diffHours < 24) return "upcoming";
	return "active";
};

/**
 * Get status color for badges
 */
export const getStatusColor = (
	nextRunTime: string,
): "default" | "secondary" | "destructive" => {
	const status = getScheduleStatus(nextRunTime);
	switch (status) {
		case "overdue":
			return "destructive";
		case "upcoming":
			return "default";
		case "active":
			return "secondary";
		default:
			return "secondary";
	}
};

/**
 * Common cron presets for quick selection
 */
export const CRON_PRESETS = [
	{
		label: "Every hour",
		value: "0 */1 * * *",
		description: "Runs at the top of every hour",
	},
	{
		label: "Every 2 hours",
		value: "0 */2 * * *",
		description: "Runs every 2 hours",
	},
	{
		label: "Every 6 hours",
		value: "0 */6 * * *",
		description: "Runs every 6 hours",
	},
	{
		label: "Daily at 9 AM",
		value: "0 9 * * *",
		description: "Runs every day at 9:00 AM",
	},
	{
		label: "Daily at 6 PM",
		value: "0 18 * * *",
		description: "Runs every day at 6:00 PM",
	},
	{
		label: "Weekly (Monday 9 AM)",
		value: "0 9 * * 1",
		description: "Runs every Monday at 9:00 AM",
	},
	{
		label: "Monthly (1st at 9 AM)",
		value: "0 9 1 * *",
		description: "Runs on the 1st of every month at 9:00 AM",
	},
] as const;
