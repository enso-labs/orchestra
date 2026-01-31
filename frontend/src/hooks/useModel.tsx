import { listModels, ModelsResponse } from "@/lib/services/modelService";
import { getSettings } from "@/lib/services/userSettingsService";
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

	// Fetch user's default model preference
	useEffect(() => {
		const fetchUserDefault = async () => {
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

	useEffect(() => {
		if (!model) {
			// User default takes precedence over server-wide default
			const effectiveDefault = userDefault || models.default;
			if (effectiveDefault) {
				setModel(effectiveDefault);
			}
		}
	}, [model, models.default, userDefault]);

	return {
		model,
		setModel,
		updateQueryStateModel,
		models,
		useModelsEffect,
	};
}

export default useModel;
