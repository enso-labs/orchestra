import apiClient from "@/lib/utils/apiClient";
import { Project, Source } from "@/lib/entities/project";

export default class ProjectService {
	private static readonly BASE_URL = "/projects";

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
			console.error("Failed to search projects:", error);
			throw error;
		}
	}

	static async create(project: Partial<Project>) {
		try {
			const response = await apiClient.post(this.BASE_URL, project);
			return response;
		} catch (error) {
			console.error("Failed to create project:", error);
			throw error;
		}
	}

	static async get(projectId: string) {
		try {
			const response = await apiClient.get(`${this.BASE_URL}/${projectId}`);
			return response;
		} catch (error) {
			console.error("Failed to get project:", error);
			throw error;
		}
	}

	static async delete(projectId: string) {
		try {
			const response = await apiClient.delete(`${this.BASE_URL}/${projectId}`);
			return response;
		} catch (error) {
			console.error("Failed to delete project:", error);
			throw error;
		}
	}

	static async getSources(projectId: string) {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/${projectId}/sources`,
			);
			return response;
		} catch (error) {
			console.error("Failed to get project sources:", error);
			throw error;
		}
	}

	static async addSource(projectId: string, sources: Source[]) {
		try {
			const response = await apiClient.post(
				`${this.BASE_URL}/${projectId}/sources`,
				sources,
			);
			return response;
		} catch (error) {
			console.error("Failed to add source to project:", error);
			throw error;
		}
	}

	static async deleteSource(projectId: string, sourceId: string) {
		try {
			const response = await apiClient.delete(
				`${this.BASE_URL}/${projectId}/sources/${sourceId}`,
			);
			return response;
		} catch (error) {
			console.error("Failed to delete source from project:", error);
			throw error;
		}
	}
}

export const projectService = new ProjectService();
