import apiClient from "@/lib/utils/apiClient";
import type {
	HeartbeatConfig,
	HeartbeatState,
	HeartbeatTickResult,
} from "@/lib/entities/heartbeat";

export class HeartbeatService {
	private static readonly BASE_URL = "/heartbeat";

	static async getConfig(): Promise<{ config: HeartbeatConfig | null }> {
		try {
			const response = await apiClient.get(this.BASE_URL);
			const data = response.data;
			// Backend returns empty object {} when no config
			const config =
				data && Object.keys(data).length > 0 ? (data as HeartbeatConfig) : null;
			return { config };
		} catch (error) {
			console.error("Failed to fetch heartbeat config:", error);
			throw error;
		}
	}

	static async upsertConfig(
		config: Partial<HeartbeatConfig>,
	): Promise<HeartbeatConfig> {
		try {
			const response = await apiClient.put(this.BASE_URL, config);
			return response.data;
		} catch (error) {
			console.error("Failed to upsert heartbeat config:", error);
			throw error;
		}
	}

	static async deleteConfig(): Promise<void> {
		try {
			await apiClient.delete(this.BASE_URL);
		} catch (error) {
			console.error("Failed to delete heartbeat config:", error);
			throw error;
		}
	}

	static async getState(): Promise<HeartbeatState> {
		try {
			const response = await apiClient.get(`${this.BASE_URL}/state`);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch heartbeat state:", error);
			throw error;
		}
	}

	static async triggerTick(): Promise<HeartbeatTickResult> {
		try {
			const response = await apiClient.post(`${this.BASE_URL}/tick`);
			return response.data;
		} catch (error) {
			console.error("Failed to trigger heartbeat tick:", error);
			throw error;
		}
	}

	static async getHistory(limit: number = 20): Promise<HeartbeatTickResult[]> {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/history?limit=${limit}`,
			);
			return response.data;
		} catch (error) {
			console.error("Failed to fetch heartbeat history:", error);
			throw error;
		}
	}
}

export default HeartbeatService;
