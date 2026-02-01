export interface ScheduleCreate {
	title: string;
	trigger: {
		type: "cron";
		expression: string; // e.g., "0 */1 * * *" (minimum 1 hour intervals)
	};
	task: {
		model: string;
		system?: string;
		system_prompt?: string;
		instructions?: string;
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
	title: string;
	trigger: {
		type: "cron";
		expression: string;
	};
	task: {
		model: string;
		system?: string;
		system_prompt?: string;
		instructions?: string;
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

export interface ScheduleExecution {
	id: string;
	schedule_id: string;
	thread_id: string | null;
	status: "scheduled" | "running" | "success" | "failure";
	scheduled_time: string;
	started_at: string | null;
	completed_at: string | null;
	error_message: string | null;
	metadata: Record<string, any>;
}

export interface ScheduleEvent {
	id: string;
	title: string;
	start: Date;
	end: Date;
	resource: {
		schedule_id: string;
		execution_id: string;
		thread_id: string | null;
		status: string;
		agent_id: string | null;
	};
}

export interface ScheduleWithExecutions extends Schedule {
	executions: ScheduleExecution[];
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
	customSystemPrompt?: string;
	customInstructions?: string;
	customTools?: string[];
}
