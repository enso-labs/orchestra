import { useQuery } from "@tanstack/react-query";
import { listModels, ModelsResponse } from "@/lib/services/modelService";
import { queryKeys } from "@/lib/queryKeys";

const EMPTY_MODELS: ModelsResponse = { default: "", free: [], models: [] };

/**
 * Standalone hook to fetch the available models list from /llm/models.
 * Can be used independently of ChatContext (e.g., in schedule forms).
 */
export function useModelsList() {
	const { data: models = EMPTY_MODELS, isLoading } = useQuery({
		queryKey: queryKeys.models(),
		queryFn: () => listModels().then((r) => r.data),
	});

	return { models, isLoading };
}

export default useModelsList;
