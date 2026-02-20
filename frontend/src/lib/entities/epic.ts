export interface Epic {
	id?: string;
	name: string;
	description?: string;
	status?: string;
	metadata?: Record<string, any>;
	created_at?: string;
	updated_at?: string;
}

export interface Task {
	id?: string;
	epic_id: string;
	title: string;
	description?: string;
	status?: string;
	assignee?: string;
	blockers: string[];
	metadata?: Record<string, any>;
	created_at?: string;
	updated_at?: string;
}

export interface TaskSearchResult {
	task_id: string;
	title: string;
	status: string;
	epic_id: string;
	score: number;
}
