export interface CronCreate {
	title: string;
	trigger: {
		type: "cron";
		expression: string; // e.g., "0 */1 * * *" (minimum 1 hour intervals)
	};
	task: {
		input: {
			messages: Array<{
				role: "user" | "assistant" | "system" | "tool";
				content: string;
			}>;
			files?: Record<string, any>;
		};
		model: string;
		system_prompt?: string;
		instructions?: string;
		tools?: string[];
		a2a?: Record<string, any>;
		mcp?: Record<string, any>;
		subagents?: Array<any>;
		metadata?: CronTaskMetadata;
	};
}

export interface CronTaskMetadata {
	user_id?: string;
	thread_id?: string;
	checkpoint_id?: string;
	assistant_id?: string;
	project_id?: string;
	graph_id?: "react" | "deepagent";
	[key: string]: any;
}

export interface Cron {
	id: string;
	title: string;
	trigger: {
		type: "cron";
		expression: string;
	};
	task: {
		input: {
			messages: Array<{
				role: "user" | "assistant" | "system" | "tool";
				content: string;
			}>;
			files?: Record<string, any>;
		};
		model: string;
		system_prompt?: string;
		instructions?: string;
		tools?: string[];
		a2a?: Record<string, any>;
		mcp?: Record<string, any>;
		subagents?: Array<any>;
		metadata?: CronTaskMetadata;
	};
	next_run_time: string; // ISO datetime
	agent_id?: string; // Link to specific agent
}

export interface CronExecution {
	id: string;
	cron_id: string;
	thread_id: string | null;
	status: "scheduled" | "running" | "success" | "failure";
	scheduled_time: string;
	started_at: string | null;
	completed_at: string | null;
	error_message: string | null;
	metadata: Record<string, any>;
}

export interface CronEvent {
	id: string;
	title: string;
	start: Date;
	end: Date;
	resource: {
		cron_id: string;
		execution_id: string;
		thread_id: string | null;
		status: string;
		agent_id: string | null;
	};
}

export interface CronWithExecutions extends Cron {
	executions: CronExecution[];
}

export interface CronFormData {
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
