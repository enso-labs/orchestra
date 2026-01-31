import apiClient from "@/lib/utils/apiClient";

export interface ProviderKeyStatus {
	provider: string;
	is_set: boolean;
}

export interface UserSettingsResponse {
	default_model: string | null;
	provider_keys: ProviderKeyStatus[];
}

export const getSettings = async (): Promise<UserSettingsResponse> => {
	const response = await apiClient.get("/settings");
	return response.data;
};

export const updateDefaultModel = async (
	model: string | null,
): Promise<UserSettingsResponse> => {
	const response = await apiClient.put("/settings/default-model", { model });
	return response.data;
};

export const upsertProviderKey = async (
	provider: string,
	apiKey: string,
): Promise<UserSettingsResponse> => {
	const response = await apiClient.put("/settings/provider-keys", {
		provider,
		api_key: apiKey,
	});
	return response.data;
};

export const deleteProviderKey = async (
	provider: string,
): Promise<UserSettingsResponse> => {
	const response = await apiClient.delete(
		`/settings/provider-keys/${provider}`,
	);
	return response.data;
};
