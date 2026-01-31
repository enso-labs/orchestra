import {
	Server,
	McpServerCreate,
	McpServerUpdate,
	McpServerTestConnectionRequest,
} from "@/lib/entities";
import apiClient from "@/lib/utils/apiClient";

// --- Legacy server endpoints (type/description/public schema) ---

export const listServers = async (
	limit: number = 100,
	offset: number = 0,
	type: string = "mcp",
) => {
	const response = await apiClient.get("/servers", {
		params: { limit, offset, type },
	});
	return response;
};

export const listPublicServers = async (
	limit: number = 100,
	offset: number = 0,
	type: string = "mcp",
) => {
	const response = await apiClient.get("/servers/public", {
		params: { limit, offset, type },
	});
	return response;
};

export const getServer = async (serverId: string) => {
	const response = await apiClient.get(`/servers/${serverId}`);
	return response;
};

export const createServer = async (server: Server) => {
	const response = await apiClient.post("/servers", server);
	return response;
};

export const updateServer = async (serverId: string, server: Server) => {
	const response = await apiClient.put(`/servers/${serverId}`, server);
	return response;
};

export const deleteServer = async (serverId: string) => {
	const response = await apiClient.delete(`/servers/${serverId}`);
	return response;
};

export const getServerBySlug = async (slug: string) => {
	const response = await apiClient.get(`/servers/slug/${slug}`);
	return response;
};

// --- New MCP server config endpoints (saved server configurations) ---

export default class McpServerService {
	private static readonly BASE_URL = "/servers";

	static async list(limit: number = 100, offset: number = 0) {
		try {
			const response = await apiClient.get(this.BASE_URL, {
				params: { limit, offset },
			});
			return response;
		} catch (error) {
			console.error("Failed to list MCP servers:", error);
			throw error;
		}
	}

	static async get(serverId: string) {
		try {
			const response = await apiClient.get(`${this.BASE_URL}/${serverId}`);
			return response;
		} catch (error) {
			console.error("Failed to get MCP server:", error);
			throw error;
		}
	}

	static async create(server: McpServerCreate) {
		try {
			const response = await apiClient.post(this.BASE_URL, server);
			return response;
		} catch (error) {
			console.error("Failed to create MCP server:", error);
			throw error;
		}
	}

	static async update(serverId: string, server: McpServerUpdate) {
		try {
			const response = await apiClient.put(
				`${this.BASE_URL}/${serverId}`,
				server,
			);
			return response;
		} catch (error) {
			console.error("Failed to update MCP server:", error);
			throw error;
		}
	}

	static async delete(serverId: string) {
		try {
			const response = await apiClient.delete(`${this.BASE_URL}/${serverId}`);
			return response;
		} catch (error) {
			console.error("Failed to delete MCP server:", error);
			throw error;
		}
	}

	static async testConnection(request: McpServerTestConnectionRequest) {
		try {
			const response = await apiClient.post(
				`${this.BASE_URL}/test-connection`,
				request,
			);
			return response;
		} catch (error) {
			console.error("Failed to test MCP server connection:", error);
			throw error;
		}
	}

	static async discoverTools(serverId: string) {
		try {
			const response = await apiClient.get(
				`${this.BASE_URL}/${serverId}/tools`,
			);
			return response;
		} catch (error) {
			console.error("Failed to discover MCP server tools:", error);
			throw error;
		}
	}
}
