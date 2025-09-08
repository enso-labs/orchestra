import apiClient from "@/lib/utils/apiClient";

export const getAgents = async () => {
	const response = await apiClient.get("/agents");
	return response;
};

export const getAgent = async (agentId: string) => {
	const response = await apiClient.get(`/agents/${agentId}`);
	return response.data;
};

export const createAgent = async (data: {
	name: string;
	description: string;
	settings_id: string;
	public?: boolean;
}) => {
	const response = await apiClient.post("/agents", data);
	return response.data;
};

export const updateAgent = async (
	agentId: string,
	data: {
		name?: string;
		description?: string;
		// settings_id?: string;
		public?: boolean;
	},
) => {
	const response = await apiClient.put(`/agents/${agentId}`, data);
	return response.data;
};

export const deleteAgent = async (agentId: string) => {
	const response = await apiClient.delete(`/agents/${agentId}`);
	return response.data;
};

export const createAgentRevision = async (
	agentId: string,
	data: {
		name: string;
		description: string;
		settings_id: string;
	},
) => {
	const response = await apiClient.post(`/agents/${agentId}/v`, data);
	return response;
};
