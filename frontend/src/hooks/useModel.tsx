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

	useEffect(() => {
		if (!model) {
			setModel(models.default);
		}
	}, [model, models.default]);

	return {
		model,
		setModel,
		models,
		useModelsEffect,
	};
}

export default useModel;
