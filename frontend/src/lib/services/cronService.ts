import apiClient from "@/lib/utils/apiClient";
import { Cron, CronCreate, CronExecution } from "@/lib/entities/cron";

export class CronService {
	private static readonly BASE_URL = "/crons";

	/**
	 * Get all crons for a specific agent
	 */
	static async getAgentCrons(agentId: string): Promise<{ crons: Cron[] }> {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}?agent_id=${agentId}`,
			);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch agent crons:", error);
			throw error;
		}
	}

	/**
	 * Get all crons for the current user
	 */
	static async getAllCrons(): Promise<{ crons: Cron[] }> {
		try {
			const response = await apiClient.get(this.BASE_URL);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch crons:", error);
			throw error;
		}
	}

	/**
	 * Get a specific cron by ID
	 */
	static async getCron(cronId: string): Promise<{ cron: Cron }> {
		try {
			const response = await apiClient.get(`${this.BASE_URL}/${cronId}`);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch cron:", error);
			throw error;
		}
	}

	/**
	 * Create a new cron
	 */
	static async createCron(
		cron: CronCreate,
	): Promise<{ job: { id: string; next_run_time: string } }> {
		try {
			const response = await apiClient.post(this.BASE_URL, cron);
			return response.data;
		} catch (error) {
			console.error("Failed to create cron:", error);
			throw error;
		}
	}

	/**
	 * Update an existing cron
	 */
	static async updateCron(
		cronId: string,
		cron: CronCreate,
	): Promise<{ job: { id: string; next_run_time: string } }> {
		try {
			const response = await apiClient.put(`${this.BASE_URL}/${cronId}`, cron);
			return response.data;
		} catch (error) {
			console.error("Failed to update cron:", error);
			throw error;
		}
	}

	/**
	 * Delete a cron
	 */
	static async deleteCron(cronId: string): Promise<void> {
		try {
			await apiClient.delete(`${this.BASE_URL}/${cronId}`);
		} catch (error) {
			console.error("Failed to delete cron:", error);
			throw error;
		}
	}

	/**
	 * Get executions for a specific cron
	 */
	static async getCronExecutions(
		cronId: string,
		limit: number = 50,
	): Promise<CronExecution[]> {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/${cronId}/executions?limit=${limit}`,
			);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch cron executions:", error);
			throw error;
		}
	}

	/**
	 * Get recent executions across all crons
	 */
	static async getRecentExecutions(
		limit: number = 20,
	): Promise<CronExecution[]> {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/executions/recent?limit=${limit}`,
			);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch recent executions:", error);
			throw error;
		}
	}

	/**
	 * Get executions within a date range
	 */
	static async getExecutionsByDateRange(
		startDate: string,
		endDate: string,
	): Promise<CronExecution[]> {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/executions?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
			);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch executions by date range:", error);
			throw error;
		}
	}

	/**
	 * Update a cron for a specific agent with agent context
	 */
	static async updateAgentCron(
		agentId: string,
		cronId: string,
		cron: CronCreate,
	): Promise<{ job: { id: string; next_run_time: string } }> {
		try {
			// Enhance cron with agent context
			const enhancedCron: CronCreate = {
				...cron,
				task: {
					...cron.task,
					metadata: {
						...cron.task.metadata,
						agent_id: agentId,
					},
				},
			};
			return await this.updateCron(cronId, enhancedCron);
		} catch (error) {
			console.error("Failed to update agent cron:", error);
			throw error;
		}
	}

	/**
	 * Create a cron for a specific agent with agent context
	 */
	static async createAgentCron(
		agentId: string,
		cron: CronCreate,
	): Promise<{ job: { id: string; next_run_time: string } }> {
		try {
			// Enhance cron with agent context
			const enhancedCron: CronCreate = {
				...cron,
				task: {
					...cron.task,
					metadata: {
						...cron.task.metadata,
						agent_id: agentId,
					},
				},
			};
			return await this.createCron(enhancedCron);
		} catch (error) {
			console.error("Failed to create agent cron:", error);
			throw error;
		}
	}
}

export default CronService;
