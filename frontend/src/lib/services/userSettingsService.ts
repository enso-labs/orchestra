import apiClient from "@/lib/utils/apiClient";

export type SandboxType = "daytona" | "state" | "mcp";

export interface ProviderKeyStatus {
	provider: string;
	is_set: boolean;
}

export interface PersistedContextFile {
	content: string[];
	created_at: string | null;
	modified_at: string | null;
}

export interface DefaultsResponse {
	model: string | null;
	sandbox: string | null;
	tools: string[] | null;
	mcp: Record<string, any> | null;
	a2a: Record<string, any> | null;
	subagents: string[] | null;
	model_visibility: string[] | null;
	files: Record<string, PersistedContextFile> | null;
	deleted_files: string[] | null;
	onboarding_completed: boolean | null;
	timezone: string | null;
	mcp_sandbox_url: string | null;
}

export interface UserSettingsResponse {
	defaults: DefaultsResponse;
	provider_keys: ProviderKeyStatus[];
}

export const getSettings = async (): Promise<UserSettingsResponse> => {
	const response = await apiClient.get("/settings");
	return response.data;
};

export const patchDefaults = async (
	data: Partial<{
		model: string | null;
		sandbox: string | null;
		tools: string[] | null;
		mcp: Record<string, any> | null;
		a2a: Record<string, any> | null;
		subagents: string[] | null;
		model_visibility: string[] | null;
		files: Record<string, PersistedContextFile> | null;
		deleted_files: string[] | null;
		onboarding_completed: boolean | null;
		timezone: string | null;
		mcp_sandbox_url: string | null;
	}>,
): Promise<UserSettingsResponse> => {
	const response = await apiClient.patch("/settings/default", data);
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
