import apiClient from "@/lib/utils/apiClient";
import { Schedule, ScheduleCreate } from "@/lib/entities/schedule";

export type Agent = {
	id?: string;
	name: string;
	description: string;
	model: string;
	prompt?: string;
	system_prompt?: string;
	instructions?: string;
	tools: string[];
	subagents?: Agent[];
	mcp?: {
		[key: string]: {
			transport: string;
			url: string;
			headers: Record<string, string>;
		};
	};
	a2a?: {
		[key: string]: {
			base_url: string;
			agent_card_path: string;
		};
	};
	files?: Record<string, string>; // Persisted files (path -> content)
	metadata?: Record<string, unknown>;
	schedules?: Schedule[]; // Agent's associated schedules
	created_at?: string;
	updated_at?: string;
	// Public agent fields
	public?: boolean;
	owner_id?: string;
	published_at?: string;
	fork_count?: number;
	tags?: string[];
};

export default class AgentService {
	private static readonly BASE_URL = "/assistants";

	static async search({
		filter = {},
		limit = 200,
		offset = 0,
	}: {
		filter?: object;
		limit?: number;
		offset?: number;
	} = {}) {
		try {
			const response = await apiClient.post(this.BASE_URL + "/search", {
				limit,
				offset,
				filter,
			});
			return response;
		} catch (error) {
			console.error("Failed to search agents:", error);
			throw error;
		}
	}

	static async create(agent: Agent) {
		try {
			const response = await apiClient.post(this.BASE_URL, agent);
			return response;
		} catch (error) {
			console.error("Failed to create agent:", error);
			throw error;
		}
	}

	static async update(assistantId: string, agent: Agent) {
		try {
			const response = await apiClient.put(
				`${this.BASE_URL}/${assistantId}`,
				agent,
			);
			return response;
		} catch (error) {
			console.error("Failed to update agent:", error);
			throw error;
		}
	}

	static async delete(agentId: string) {
		try {
			const response = await apiClient.delete(`${this.BASE_URL}/${agentId}`);
			return response;
		} catch (error) {
			console.error("Failed to delete agent:", error);
			throw error;
		}
	}

	// Schedule-related methods
	static async getAgentSchedules(agentId: string) {
		try {
			const response = await apiClient.get(`/schedules?agent_id=${agentId}`);
			return response;
		} catch (error) {
			console.error("Failed to fetch agent schedules:", error);
			throw error;
		}
	}

	static async createAgentSchedule(agentId: string, schedule: ScheduleCreate) {
		try {
			// Enhance schedule with agent context
			const enhancedSchedule = {
				...schedule,
				task: {
					...schedule.task,
					metadata: {
						...schedule.task.metadata,
						agent_id: agentId,
					},
				},
			};
			const response = await apiClient.post("/schedules", enhancedSchedule);
			return response;
		} catch (error) {
			console.error("Failed to create agent schedule:", error);
			throw error;
		}
	}

	static async deleteAgentSchedule(scheduleId: string) {
		try {
			const response = await apiClient.delete(`/schedules/${scheduleId}`);
			return response;
		} catch (error) {
			console.error("Failed to delete agent schedule:", error);
			throw error;
		}
	}

	// Public agent methods

	/**
	 * Publish an assistant (make it publicly accessible)
	 */
	static async publish(assistantId: string) {
		try {
			const response = await apiClient.post(
				`${this.BASE_URL}/${assistantId}/publish`,
			);
			return response;
		} catch (error) {
			console.error("Failed to publish assistant:", error);
			throw error;
		}
	}

	/**
	 * Unpublish an assistant (make it private)
	 */
	static async unpublish(assistantId: string) {
		try {
			const response = await apiClient.delete(
				`${this.BASE_URL}/${assistantId}/publish`,
			);
			return response;
		} catch (error) {
			console.error("Failed to unpublish assistant:", error);
			throw error;
		}
	}

	/**
	 * Get a public assistant by ID (no auth required)
	 */
	static async getPublic(assistantId: string) {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/public/${assistantId}`,
			);
			return response;
		} catch (error) {
			console.error("Failed to get public assistant:", error);
			throw error;
		}
	}

	/**
	 * List all public assistants (no auth required)
	 */
	static async listPublic(
		limit: number = 50,
		offset: number = 0,
		sortBy?: "fork_count" | "published_at" | "updated_at",
		tags?: string[],
	) {
		try {
			const params: Record<string, string | number> = { limit, offset };
			if (sortBy) params.sort_by = sortBy;
			if (tags && tags.length > 0) params.tags = tags.join(",");
			const response = await apiClient.get(`${this.BASE_URL}/public`, {
				params,
			});
			return response;
		} catch (error) {
			console.error("Failed to list public assistants:", error);
			throw error;
		}
	}

	/**
	 * Fork a public assistant into the current user's workspace (requires auth)
	 */
	static async fork(assistantId: string) {
		try {
			const response = await apiClient.post(
				`${this.BASE_URL}/public/${assistantId}/fork`,
			);
			return response;
		} catch (error) {
			console.error("Failed to fork assistant:", error);
			throw error;
		}
	}
}

export const agentService = new AgentService();
