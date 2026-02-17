import { listModels, ModelsResponse } from "@/lib/services/modelService";
import { getAuthToken } from "@/lib/utils/auth";
import { useCallback, useEffect, useState } from "react";

export function useModel() {
	const [model, setModelState] = useState<string | null>(null);
	const [models, setModels] = useState<ModelsResponse>({
		default: "",
		free: [],
		models: [],
	});

	const useModelsEffect = () => {
		useEffect(() => {
			if (!getAuthToken()) return;
			const fetchModels = async () => {
				const response = await listModels();
				setModels(response.data);
			};
			fetchModels();
		}, []);
	};

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
