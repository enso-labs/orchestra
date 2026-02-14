import apiClient from "@/lib/utils/apiClient";
import type {
	Skill,
	SkillListResponse,
	SkillCreateRequest,
	SkillUpdateRequest,
} from "@/lib/entities/skill";

export default class SkillService {
	private static readonly BASE_URL = "/skills";

	static async search({
		limit = 20,
		offset = 0,
		query,
	}: {
		limit?: number;
		offset?: number;
		query?: string;
	} = {}): Promise<SkillListResponse> {
		const body: Record<string, any> = { limit, offset };
		if (query) body.query = query;
		const response = await apiClient.post(`${this.BASE_URL}/search`, body);
		return response.data;
	}

	static async get(skillName: string): Promise<Skill> {
		const response = await apiClient.get(`${this.BASE_URL}/${skillName}`);
		return response.data;
	}

	static async create(payload: SkillCreateRequest): Promise<Skill> {
		const response = await apiClient.post(this.BASE_URL, payload);
		return response.data;
	}

	static async update(
		skillName: string,
		payload: SkillUpdateRequest,
	): Promise<Skill> {
		const response = await apiClient.put(
			`${this.BASE_URL}/${skillName}`,
			payload,
		);
		return response.data;
	}

	static async toggle(skillName: string): Promise<Skill> {
		const response = await apiClient.patch(
			`${this.BASE_URL}/${skillName}/toggle`,
		);
		return response.data;
	}

	static async delete(skillName: string): Promise<void> {
		await apiClient.delete(`${this.BASE_URL}/${skillName}`);
	}
}
