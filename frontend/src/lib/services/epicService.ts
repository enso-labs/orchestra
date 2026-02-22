import apiClient from "@/lib/utils/apiClient";
import { Epic, Task } from "@/lib/entities/epic";

export default class EpicService {
	private static readonly BASE_URL = "/epics";
	private static readonly TASK_BASE_URL = "/tasks";

	// Epic methods

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
			console.error("Failed to search epics:", error);
			throw error;
		}
	}

	static async create(epic: Partial<Epic>) {
		try {
			const response = await apiClient.post(this.BASE_URL, epic);
			return response;
		} catch (error) {
			console.error("Failed to create epic:", error);
			throw error;
		}
	}

	static async get(epicId: string) {
		try {
			const response = await apiClient.get(`${this.BASE_URL}/${epicId}`);
			return response;
		} catch (error) {
			console.error("Failed to get epic:", error);
			throw error;
		}
	}

	static async update(epicId: string, epic: Partial<Epic>) {
		try {
			const response = await apiClient.put(
				`${this.BASE_URL}/${epicId}`,
				epic,
			);
			return response;
		} catch (error) {
			console.error("Failed to update epic:", error);
			throw error;
		}
	}

	static async delete(epicId: string) {
		try {
			const response = await apiClient.delete(`${this.BASE_URL}/${epicId}`);
			return response;
		} catch (error) {
			console.error("Failed to delete epic:", error);
			throw error;
		}
	}

	// Task methods

	static async createTask(epicId: string, task: Partial<Task>) {
		try {
			const response = await apiClient.post(
				`${this.BASE_URL}/${epicId}/tasks`,
				task,
			);
			return response;
		} catch (error) {
			console.error("Failed to create task:", error);
			throw error;
		}
	}

	static async listTasks(epicId: string) {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/${epicId}/tasks`,
			);
			return response;
		} catch (error) {
			console.error("Failed to list tasks:", error);
			throw error;
		}
	}

	static async updateTask(
		epicId: string,
		taskId: string,
		task: Partial<Task>,
	) {
		try {
			const response = await apiClient.put(
				`${this.BASE_URL}/${epicId}/tasks/${taskId}`,
				task,
			);
			return response;
		} catch (error) {
			console.error("Failed to update task:", error);
			throw error;
		}
	}

	static async deleteTask(epicId: string, taskId: string) {
		try {
			const response = await apiClient.delete(
				`${this.BASE_URL}/${epicId}/tasks/${taskId}`,
			);
			return response;
		} catch (error) {
			console.error("Failed to delete task:", error);
			throw error;
		}
	}

	static async searchTasks({
		filter = {},
		limit = 200,
		offset = 0,
	}: {
		filter?: object;
		limit?: number;
		offset?: number;
	} = {}) {
		try {
			const response = await apiClient.post(
				this.TASK_BASE_URL + "/search",
				{
					limit,
					offset,
					filter,
				},
			);
			return response;
		} catch (error) {
			console.error("Failed to search tasks:", error);
			throw error;
		}
	}
}

export const epicService = new EpicService();
