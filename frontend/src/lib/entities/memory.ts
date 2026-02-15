export interface Memory {
	id: string;
	content: string;
	enabled: boolean;
	metadata?: Record<string, any> | null;
	created_at?: string;
	updated_at?: string;
}

export interface MemoryListResponse {
	memories: Memory[];
	total: number;
	limit: number;
	offset: number;
}

export interface MemoryCreateRequest {
	content: string;
	path: string;
	metadata?: Record<string, any> | null;
}

export interface MemoryUpdateRequest {
	content: string;
	metadata?: Record<string, any> | null;
	enabled?: boolean;
}
