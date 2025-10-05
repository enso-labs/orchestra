export interface ScheduleCreate {
	trigger: {
		type: "cron";
		expression: string; // e.g., "0 1 * * *" (minimum 1 hour intervals)
	};
	task: {
		model: string;
		system: string;
		messages: Array<{
			role: "user" | "assistant" | "system" | "tool";
			content: string;
		}>;
		tools?: string[];
		a2a?: Record<string, any>;
		mcp?: Record<string, any>;
		subagents?: Array<any>;
		metadata?: Record<string, any>;
	};
}

export interface Schedule {
	id: string;
	trigger: {
		type: "cron";
		expression: string;
	};
	task: {
		model: string;
		system: string;
		messages: Array<{
			role: "user" | "assistant" | "system" | "tool";
			content: string;
		}>;
		tools?: string[];
		a2a?: Record<string, any>;
		mcp?: Record<string, any>;
		subagents?: Array<any>;
		metadata?: Record<string, any>;
	};
	next_run_time: string; // ISO datetime
	agent_id?: string; // Link to specific agent
}

export interface ScheduleFormData {
	name: string;
	description?: string;
	enabled: boolean;
	cronExpression: string;
	message: string;
	inheritFromAgent: boolean;
	customModel?: string;
	customSystem?: string;
	customTools?: string[];
}
