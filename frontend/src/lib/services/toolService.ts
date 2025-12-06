import apiClient from "@/lib/utils/apiClient";

export const listTools = async () => {
	const response = await apiClient.get("/tools");
	return response.data;
};

export const createTool = async (tool: any) => {
	const response = await apiClient.post("/tools", tool);
	return response.data;
};

export const deleteTool = async (name: string) => {
	const response = await apiClient.delete(`/tools/${name}`);
	return response.data;
};

export const getUserTools = async () => {
	const data = await listTools();
	// Filter for tools with 'custom' tag
	// Note: Backend must ensure custom tools have this tag
	return (data.tools || []).filter(
		(tool: any) => tool.tags && tool.tags.includes("custom"),
	);
};

export const listToolsArcade = async (
	toolkit?: string,
	offset?: number,
	limit?: number,
) => {
	const params = new URLSearchParams();
	if (toolkit) params.append("toolkit", toolkit);
	if (offset !== undefined) params.append("offset", offset.toString());
	if (limit !== undefined) params.append("limit", limit.toString());

	const response = await apiClient.get(
		`/tools/arcade${params.toString() ? `?${params.toString()}` : ""}`,
	);
	return response;
};

export const getToolArcade = async (name: string) => {
	const response = await apiClient.get(`/tools/arcade/${name}`);
	return response;
};

export const getServerInfo = async (type: string, config: any) => {
	const response = await apiClient.post(`/tools/${type}/info`, config);
	return response;
};

export const getMcpTools = async (mcpServers: Record<string, any>) => {
	const response = await apiClient.post("/tools/mcp/info", mcpServers);
	return response.data;
};

export const getA2aAgents = async (a2aServers: Record<string, any>) => {
	const response = await apiClient.post("/tools/a2a/info", a2aServers);
	return response.data;
};

export const getDefaultSpec = async () => {
	const response = await fetch(
		"https://raw.githubusercontent.com/ryaneggz/static/refs/heads/main/enso/airtable-spec.json",
	);
	const data = await response.json();
	return data;
};

export const convertSpecToTool = async (
	name: string,
	description: string,
	spec: any,
	headers: any,
) => {
	return {
		name,
		description,
		spec,
		headers,
	};
};
