export interface Source {
	id?: string;
	type: string;
	content: {
		text?: string;
		url?: string;
		[key: string]: any;
	};
	metadata?: Record<string, any>;
	documents?: string[];
	created_at?: string;
	updated_at?: string;
}

export interface Project {
	id?: string;
	name: string;
	description?: string;
	sources?: Source[];
	created_at?: string;
	updated_at?: string;
}
