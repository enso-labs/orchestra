export interface Tool {
	name: string;
	description: string;
	icon?: string;
	tags: string[];
	metadata?: Record<string, any>;
	args?: Record<string, any>;
	category?: ToolCategory;
}

export interface ToolDetail extends Tool {
	args: Record<string, any>;
	metadata: Record<string, any>;
}

export type ToolCategory = "platform" | "mcp" | "a2a" | "arcade";

export interface ToolSelectionState {
	selectedTools: Set<string>;
	activeCategory: ToolCategory;
	searchQuery: string;
	filterTags: string[];
}

export interface CategoryConfig {
	id: ToolCategory;
	label: string;
	icon: any; // Lucide icon component
}

export interface McpServerConfig {
	transport: "sse" | "streamable_http" | "stdio";
	url: string;
	headers: Record<string, string>;
}

export interface A2aServerConfig {
	base_url: string;
	agent_card_path: string;
}
