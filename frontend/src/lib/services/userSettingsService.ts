import apiClient from "@/lib/utils/apiClient";

export interface ProviderKeyStatus {
	provider: string;
	is_set: boolean;
}

export type SandboxBackend = "daytona";

export interface UserSettingsResponse {
	default_model: string | null;
	provider_keys: ProviderKeyStatus[];
	sandbox_backend: SandboxBackend | null;
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

export const updateSandboxBackend = async (
	sandboxBackend: SandboxBackend | null,
): Promise<UserSettingsResponse> => {
	const response = await apiClient.put("/settings/sandbox-backend", {
		sandbox_backend: sandboxBackend,
	});
	return response.data;
};
