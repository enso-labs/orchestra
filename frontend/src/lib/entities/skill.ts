export type Skill = {
	name: string;
	description: string;
	slug: string;
	category?: string;
	system_prompt?: string;
	tools?: string[];
	model?: string;
	enabled?: boolean;
};

export type SkillsResponse = {
	skills: Skill[];
	total: number;
};
