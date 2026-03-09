export interface ThreadSearchResult {
	thread_id: string;
	title: string;
	excerpt: string;
	score: number;
	updated_at: string | null;
}

export interface ThreadRecord {
	id: string;
	title?: string | null;
	messages: any[];
	files?: Record<string, any> | null;
	todos?: any[] | null;
	assistant_id?: string | null;
	project_id?: string | null;
	head_checkpoint_id?: string | null;
	checkpoint_count?: number | null;
	updated_at?: string | null;
	created_at?: string | null;
}

export interface ThreadCheckpointSummary {
	checkpoint_id: string;
	parent_checkpoint_id?: string | null;
	created_at?: string | null;
	source?: string | null;
	message_preview?: string | null;
	model?: string | null;
	has_files: boolean;
	has_todos: boolean;
	has_interrupts: boolean;
	is_restorable: boolean;
	is_head: boolean;
}

export interface ThreadCheckpointDetail {
	thread_id: string;
	checkpoint_id: string;
	parent_checkpoint_id?: string | null;
	created_at?: string | null;
	source?: string | null;
	model?: string | null;
	messages: any[];
	files: Record<string, any>;
	todos: any[];
	has_interrupts: boolean;
	is_restorable: boolean;
	metadata: Record<string, any>;
}

export interface ForkCheckpointResponse {
	thread_id: string;
	head_checkpoint_id: string;
	source_thread_id: string;
	source_checkpoint_id: string;
}

export type ThreadViewMode = "latest" | "checkpoint_preview";

export interface ThreadSearchRequest {
	query: string;
	limit?: number;
	assistant_id?: string;
}

export interface SemanticThread {
	id: string;
	messages: any[];
	files: any[];
	score: number;
	updated_at: string | null;
}
