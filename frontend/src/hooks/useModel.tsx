import { useQuery } from "@tanstack/react-query";
import { listModels, ModelsResponse } from "@/lib/services/modelService";
import { getAuthToken } from "@/lib/utils/auth";
import { useCallback, useState } from "react";
import { queryKeys } from "@/lib/queryKeys";

const EMPTY_MODELS: ModelsResponse = { default: "", free: [], models: [] };

export function useModel() {
	const [model, setModelState] = useState<string | null>(null);

	const { data: models = EMPTY_MODELS } = useQuery({
		queryKey: queryKeys.models(),
		queryFn: () => listModels().then((r) => r.data),
		enabled: !!getAuthToken(),
	});

	// Kept for backwards compatibility — consumers that called useModelsEffect() can safely remove the call
	const useModelsEffect = () => {};

	// Internal setter used for thread/agent loading (not for user-facing model switching)
	const setModel = useCallback((value: string | null) => {
		setModelState(value);
	}, []);

	// Used by agent-create-form to update model selection for agent configuration
	const updateQueryStateModel = (model: string) => {
		setModel(model);
	};

	// Reset model to null — server will resolve the user's default
	const resetToDefault = () => {
		setModel(null);
	};

	// Display-only model: shows what will be used without sending it in payloads
	const displayModel = model || models.default || null;

	return {
		model,
		setModel,
		updateQueryStateModel,
		resetToDefault,
		displayModel,
		models,
		useModelsEffect,
	};
}

export default useModel;
