import apiClient from "@/lib/utils/apiClient";
import type { FileData } from "@/hooks/useFileSystem";
import type {
	Memory,
	MemoryListResponse,
	MemoryCreateRequest,
	MemoryUpdateRequest,
} from "@/lib/entities/memory";

export default class MemoryService {
	private static readonly BASE_URL = "/memories";

	static async list({
		limit = 20,
		offset = 0,
		query,
	}: {
		limit?: number;
		offset?: number;
		query?: string;
	} = {}): Promise<MemoryListResponse> {
		const params: Record<string, any> = { limit, offset };
		if (query) params.query = query;
		const response = await apiClient.get(this.BASE_URL, { params });
		return response.data;
	}

	static async get(memoryId: string): Promise<Memory> {
		const response = await apiClient.get(`${this.BASE_URL}/${memoryId}`);
		return response.data;
	}

	static async create(payload: MemoryCreateRequest): Promise<Memory> {
		const response = await apiClient.post(this.BASE_URL, payload);
		return response.data;
	}

	static async update(
		memoryId: string,
		payload: MemoryUpdateRequest,
	): Promise<Memory> {
		const response = await apiClient.put(
			`${this.BASE_URL}/${memoryId}`,
			payload,
		);
		return response.data;
	}

	static async delete(memoryId: string): Promise<void> {
		await apiClient.delete(`${this.BASE_URL}/${memoryId}`);
	}

	static async getFiles(): Promise<Record<string, FileData>> {
		const response = await apiClient.get(`${this.BASE_URL}/files`);
		return response.data;
	}

	static async toggle(memoryId: string): Promise<Memory> {
		const response = await apiClient.patch(
			`${this.BASE_URL}/${memoryId}/toggle`,
		);
		return response.data;
	}
}
