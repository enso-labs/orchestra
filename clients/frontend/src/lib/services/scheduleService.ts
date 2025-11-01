import apiClient from "@/lib/utils/apiClient";
import { Schedule, ScheduleCreate } from "@/lib/entities/schedule";

export class ScheduleService {
	private static readonly BASE_URL = "/schedules";

	/**
	 * Get all schedules for a specific agent
	 */
	static async getAgentSchedules(
		agentId: string,
	): Promise<{ schedules: Schedule[] }> {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}?agent_id=${agentId}`,
			);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch agent schedules:", error);
			throw error;
		}
	}

	/**
	 * Get all schedules for the current user
	 */
	static async getAllSchedules(): Promise<{ schedules: Schedule[] }> {
		try {
			const response = await apiClient.get(this.BASE_URL);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch schedules:", error);
			throw error;
		}
	}

	/**
	 * Get a specific schedule by ID
	 */
	static async getSchedule(
		scheduleId: string,
	): Promise<{ schedule: Schedule }> {
		try {
			const response = await apiClient.get(`${this.BASE_URL}/${scheduleId}`);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch schedule:", error);
			throw error;
		}
	}

	/**
	 * Create a new schedule
	 */
	static async createSchedule(
		schedule: ScheduleCreate,
	): Promise<{ job: { id: string; next_run_time: string } }> {
		try {
			const response = await apiClient.post(this.BASE_URL, schedule);
			return response.data;
		} catch (error) {
			console.error("Failed to create schedule:", error);
			throw error;
		}
	}

	/**
	 * Update an existing schedule
	 */
	static async updateSchedule(
		scheduleId: string,
		schedule: ScheduleCreate,
	): Promise<{ job: { id: string; next_run_time: string } }> {
		try {
			const response = await apiClient.put(
				`${this.BASE_URL}/${scheduleId}`,
				schedule,
			);
			return response.data;
		} catch (error) {
			console.error("Failed to update schedule:", error);
			throw error;
		}
	}

	/**
	 * Delete a schedule
	 */
	static async deleteSchedule(scheduleId: string): Promise<void> {
		try {
			await apiClient.delete(`${this.BASE_URL}/${scheduleId}`);
		} catch (error) {
			console.error("Failed to delete schedule:", error);
			throw error;
		}
	}

	/**
	 * Update a schedule for a specific agent with agent context
	 */
	static async updateAgentSchedule(
		agentId: string,
		scheduleId: string,
		schedule: ScheduleCreate,
	): Promise<{ job: { id: string; next_run_time: string } }> {
		try {
			// Enhance schedule with agent context
			const enhancedSchedule: ScheduleCreate = {
				...schedule,
				task: {
					...schedule.task,
					metadata: {
						...schedule.task.metadata,
						agent_id: agentId,
					},
				},
			};
			return await this.updateSchedule(scheduleId, enhancedSchedule);
		} catch (error) {
			console.error("Failed to update agent schedule:", error);
			throw error;
		}
	}

	/**
	 * Create a schedule for a specific agent with agent context
	 */
	static async createAgentSchedule(
		agentId: string,
		schedule: ScheduleCreate,
	): Promise<{ job: { id: string; next_run_time: string } }> {
		try {
			// Enhance schedule with agent context
			const enhancedSchedule: ScheduleCreate = {
				...schedule,
				task: {
					...schedule.task,
					metadata: {
						...schedule.task.metadata,
						agent_id: agentId,
					},
				},
			};
			return await this.createSchedule(enhancedSchedule);
		} catch (error) {
			console.error("Failed to create agent schedule:", error);
			throw error;
		}
	}
}

export default ScheduleService;
