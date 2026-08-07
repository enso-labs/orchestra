import apiClient from "@/lib/utils/apiClient";

export interface ModelMetadata {
	system_message: boolean;
	reasoning: boolean;
	tool_calling: boolean;
	multimodal: boolean;
	embedding: boolean;
}

export interface Model {
	id: string;
	label: string;
	provider: string;
	metadata: ModelMetadata;
}

export interface ModelsResponse {
	default: string;
	free: string[];
	models: string[];
	/**
	 * Reasoning effort values keyed by model id, for the models that accept one.
	 * Values differ per model, so never hard-code them — a model absent from
	 * this map takes no effort and must not be offered a picker.
	 */
	reasoning?: Record<string, string[]>;
	/** The caller's saved default effort, applied when a request omits one. */
	default_reasoning_effort?: string | null;
}

export const listModels = async () => {
	const response = await apiClient.get<ModelsResponse>("/llm/models");
	return response;
};
