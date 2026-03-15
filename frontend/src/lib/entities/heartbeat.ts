export interface ActiveHours {
	start: string;
	end: string;
	timezone: string;
}

export interface HeartbeatConfig {
	user_id: string;
	assistant_id: string;
	enabled: boolean;
	checklist: string;
	every_seconds: number;
	active_hours: ActiveHours;
	isolated_session: boolean;
	light_context: boolean;
	ack_max_chars: number;
	prompt: string;
	schedule_id: string | null;
}

export interface HeartbeatState {
	last_run_at: string | null;
	last_result: string | null;
	consecutive_ok_count: number;
	next_due_at: string | null;
	total_ticks: number;
	total_escalations: number;
	last_escalation_at: string | null;
}

export interface HeartbeatTickResult {
	action: "ok" | "escalated" | "skipped";
	reason: string;
	response: string | null;
	tokens_used: number | null;
	duration_ms: number | null;
	timestamp: string;
}

export type HeartbeatInterval =
	| 300
	| 900
	| 1800
	| 3600
	| 7200
	| 14400
	| 28800
	| 43200
	| 86400;

export const HEARTBEAT_INTERVALS: {
	value: HeartbeatInterval;
	label: string;
}[] = [
	{ value: 300, label: "5 minutes" },
	{ value: 900, label: "15 minutes" },
	{ value: 1800, label: "30 minutes" },
	{ value: 3600, label: "1 hour" },
	{ value: 7200, label: "2 hours" },
	{ value: 14400, label: "4 hours" },
	{ value: 28800, label: "8 hours" },
	{ value: 43200, label: "12 hours" },
	{ value: 86400, label: "24 hours" },
];
