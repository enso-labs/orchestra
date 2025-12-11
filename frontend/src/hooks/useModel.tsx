import { listModels, ModelsResponse } from "@/lib/services/modelService";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";

export function useModel() {
	const [model, setModel] = useQueryState("model");
	const [models, setModels] = useState<ModelsResponse>({
		default: "",
		free: [],
		models: [],
	});

	const useModelsEffect = () => {
		useEffect(() => {
			const fetchModels = async () => {
				const response = await listModels();
				setModels(response.data);
			};
			fetchModels();
		}, []);
	};

	const updateQueryStateModel = (model: string) => {
		setModel(model);
	};

	useEffect(() => {
		if (!model) {
			setModel(models.default);
		}
	}, [model, models.default]);

	return {
		model,
		setModel,
		updateQueryStateModel,
		models,
		useModelsEffect,
	};
}

export default useModel;
