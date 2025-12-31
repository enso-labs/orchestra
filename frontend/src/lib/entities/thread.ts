export interface ThreadSearchResult {
	thread_id: string;
	title: string;
	excerpt: string;
	score: number;
	updated_at: string | null;
}

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
