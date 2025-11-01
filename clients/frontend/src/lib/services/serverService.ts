import { Server } from "@/lib/entities";
import apiClient from "@/lib/utils/apiClient";

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
	const response = await apiClient.patch(`/servers/${serverId}`, server);
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
