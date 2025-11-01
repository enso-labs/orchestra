import apiClient from "@/lib/utils/apiClient";

export const listSettings = async () => {
	const response = await apiClient.get("/settings");
	return response.data;
};

export const createSetting = async (data: {
	name: string;
	value: {
		system: string;
		model: string;
		tools: string[];
		mcp?: object;
	};
}) => {
	const response = await apiClient.post("/settings", data);
	return response;
};

export const updateSetting = async (
	id: string,
	data: {
		name: string;
		value: {
			system: string;
			model: string;
			tools: string[];
			mcp?: object;
		};
	},
) => {
	const response = await apiClient.put(`/settings/${id}`, data);
	return response;
};

export const deleteSetting = async (id: string) => {
	const response = await apiClient.delete(`/settings/${id}`);
	return response.data;
};
