import { listModels, ModelsResponse } from "@/lib/services/modelService";
import { useEffect, useState } from "react";

/**
 * Standalone hook to fetch the available models list from /llm/models.
 * Can be used independently of ChatContext (e.g., in cron forms).
 */
export function useModelsList() {
	const [models, setModels] = useState<ModelsResponse>({
		default: "",
		free: [],
		models: [],
	});
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		const fetchModels = async () => {
			setIsLoading(true);
			try {
				const response = await listModels();
				setModels(response.data);
			} catch (error) {
				console.error("Failed to fetch models:", error);
			} finally {
				setIsLoading(false);
			}
		};
		fetchModels();
	}, []);

	return { models, isLoading };
}

export default useModelsList;
