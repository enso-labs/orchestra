export interface Skill {
	name: string;
	description: string;
	content: string;
	tags: string[];
	disabled: boolean;
	metadata: Record<string, any>;
	allowed_tools: string[];
	license?: string;
	compatibility?: string;
	created_at?: string;
	updated_at?: string;
}

export interface SkillListResponse {
	skills: Skill[];
	total: number;
	limit: number;
	offset: number;
}

export interface SkillCreateRequest {
	name: string;
	description: string;
	content: string;
	tags?: string[];
	allowed_tools?: string[];
	license?: string;
	compatibility?: string;
}

export interface SkillUpdateRequest {
	description?: string;
	content?: string;
	tags?: string[];
	allowed_tools?: string[];
	license?: string;
	compatibility?: string;
}
