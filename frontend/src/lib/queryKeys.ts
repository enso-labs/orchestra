export const queryKeys = {
	user: () => ["user"] as const,
	settings: () => ["settings"] as const,
	models: () => ["models"] as const,
	projects: () => ["projects"] as const,
	tokens: () => ["tokens"] as const,

	agents: {
		all: () => ["agents"] as const,
		detail: (id: string) => ["agents", id] as const,
		public: (sort?: string, tags?: string[]) =>
			["agents", "public", { sort, tags }] as const,
	},

	threads: {
		all: (filter?: Record<string, unknown>) => ["threads", filter] as const,
		detail: (id: string) => ["threads", id] as const,
		checkpoints: (threadId: string) =>
			["threads", threadId, "checkpoints"] as const,
	},

	memories: (params?: { query?: string; page?: number }) =>
		["memories", params] as const,

	sandboxHealth: (url: string | null) => ["sandboxHealth", url] as const,
};
