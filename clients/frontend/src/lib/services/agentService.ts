import apiClient from "@/lib/utils/apiClient";
import { Schedule, ScheduleCreate } from "@/lib/entities/schedule";

export type Agent = {
	id?: string;
	name: string;
	description: string;
	model: string;
	prompt: string;
	tools: string[];
	subagents?: Agent[];
	mcp?: object;
	a2a?: object;
	metadata?: object;
	schedules?: Schedule[]; // Agent's associated schedules
	created_at?: string;
	updated_at?: string;
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
}

export const agentService = new AgentService();
