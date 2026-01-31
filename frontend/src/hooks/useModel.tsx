import { listModels, ModelsResponse } from "@/lib/services/modelService";
import { getSettings } from "@/lib/services/userSettingsService";
import { getAuthToken } from "@/lib/utils/auth";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";

export function useModel() {
	const [model, setModel] = useQueryState("model");
	const [models, setModels] = useState<ModelsResponse>({
		default: "",
		free: [],
		models: [],
	});
	const [userDefault, setUserDefault] = useState<string | null>(null);

	const useModelsEffect = () => {
		useEffect(() => {
			const fetchModels = async () => {
				const response = await listModels();
				setModels(response.data);
			};
			fetchModels();
		}, []);
	};

	// Fetch user's default model preference (only when authenticated)
	useEffect(() => {
		const fetchUserDefault = async () => {
			// Skip if user is not authenticated to avoid 401 loops on login page
			const token = getAuthToken();
			if (!token) return;

			try {
				const settings = await getSettings();
				setUserDefault(settings.default_model);
			} catch {
				// If settings fetch fails, fall back to server default
			}
		};
		fetchUserDefault();
	}, []);

	const updateQueryStateModel = (model: string) => {
		setModel(model);
	};

	// Reset model to user's default (or system default)
	// This clears the URL query param so the default can be re-applied
	const resetToDefault = () => {
		setModel(null);
	};

	useEffect(() => {
		// Only set default model when no explicit model is selected
		// User default takes precedence over server-wide default
		if (!model && (userDefault !== null || models.default)) {
			const effectiveDefault = userDefault ?? models.default;
			if (effectiveDefault) {
				setModel(effectiveDefault);
			}
		}
	}, [model, models.default, userDefault, setModel]);

	return {
		model,
		setModel,
		updateQueryStateModel,
		resetToDefault,
		models,
		useModelsEffect,
	};
}

export default useModel;
