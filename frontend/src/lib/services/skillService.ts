import apiClient from "@/lib/utils/apiClient";
import { Skill, SkillsResponse } from "@/lib/entities/skill";

export default class SkillService {
	private static readonly BASE_URL = "/skills";

	/**
	 * List all available skills
	 */
	static async listSkills(category?: string): Promise<SkillsResponse> {
		try {
			const params = category ? `?category=${encodeURIComponent(category)}` : "";
			const response = await apiClient.get(`${this.BASE_URL}${params}`);
			return response.data;
		} catch (error) {
			console.error("Failed to list skills:", error);
			throw error;
		}
	}

	/**
	 * Get a skill by slug
	 */
	static async getSkill(slug: string): Promise<Skill> {
		try {
			const response = await apiClient.get(`${this.BASE_URL}/${slug}`);
			return response.data;
		} catch (error) {
			console.error("Failed to get skill:", error);
			throw error;
		}
	}
}

export const skillService = new SkillService();
