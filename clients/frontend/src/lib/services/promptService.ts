import apiClient from "@/lib/utils/apiClient";
import { Prompt, PromptSearch } from "@/lib/entities/prompt";

export default class PromptService {
	private static readonly BASE_URL = "/prompts";

	/**
	 * Search prompts with optional filters
	 */
	static async search(params: PromptSearch = {}) {
		try {
			const response = await apiClient.post(`${this.BASE_URL}/search`, {
				limit: params.limit || 500,
				offset: params.offset || 0,
				sort: params.sort || "updated_at",
				sort_order: params.sort_order || "desc",
				filter: params.filter || {},
			});
			return response;
		} catch (error) {
			console.error("Failed to search prompts:", error);
			throw error;
		}
	}

	/**
	 * Create a new prompt
	 */
	static async create(prompt: Prompt) {
		try {
			const response = await apiClient.post(this.BASE_URL, prompt);
			return response;
		} catch (error) {
			console.error("Failed to create prompt:", error);
			throw error;
		}
	}

	/**
	 * Create a new revision of an existing prompt
	 */
	static async createRevision(
		promptId: string,
		prompt: Partial<Prompt>,
	) {
		try {
			const response = await apiClient.post(
				`${this.BASE_URL}/${promptId}/v`,
				prompt,
			);
			return response;
		} catch (error) {
			console.error("Failed to create prompt revision:", error);
			throw error;
		}
	}

	/**
	 * List all revisions of a prompt
	 */
	static async listRevisions(promptId: string) {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/${promptId}/v`,
			);
			return response;
		} catch (error) {
			console.error("Failed to list prompt revisions:", error);
			throw error;
		}
	}

	/**
	 * Delete a specific revision of a prompt
	 */
	static async deleteRevision(promptId: string, version: number) {
		try {
			const response = await apiClient.delete(
				`${this.BASE_URL}/${promptId}/v/${version}`,
			);
			return response;
		} catch (error) {
			console.error("Failed to delete prompt revision:", error);
			throw error;
		}
	}

	/**
	 * Toggle public visibility of a prompt
	 */
	static async togglePublic(promptId: string) {
		try {
			const response = await apiClient.put(
				`${this.BASE_URL}/${promptId}/public`,
			);
			return response;
		} catch (error) {
			console.error("Failed to toggle prompt visibility:", error);
			throw error;
		}
	}

	/**
	 * Get a single prompt by ID and optional version
	 */
	static async get(promptId: string, version?: number) {
		try {
			const filter: any = { id: promptId };
			if (version !== undefined) {
				filter.v = version;
			}
			const response = await this.search({ filter, limit: 1 });
			return response.data.prompts?.[0] || null;
		} catch (error) {
			console.error("Failed to get prompt:", error);
			throw error;
		}
	}
}

export const promptService = new PromptService();
