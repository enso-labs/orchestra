export type Prompt = {
	id?: string;
	name: string;
	content: string;
	public: boolean;
	v?: number;
	slug?: string;
	updated_at?: string;
	created_at?: string;
};

export type PromptSearch = {
	limit?: number;
	offset?: number;
	sort?: string;
	sort_order?: string;
	filter?: {
		id?: string;
		v?: number;
		public?: boolean;
	};
};

export type PromptRevision = Prompt & {
	prompt_id: string;
	version: number;
};
