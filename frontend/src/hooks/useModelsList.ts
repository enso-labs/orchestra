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
		// Same query key as useModel, and `retry` is resolved per *query*, not per
		// observer — whichever observer initiates the fetch sets it. Without this
		// line a fetch started here would restore the global retry:1 and put the
		// composer's outage state back behind ~40s of retries.
		//
		// The connection toast deliberately does NOT live here: useModel is the
		// single owner of that notification.
		retry: 0,
	});

	return { models, isLoading };
}

export default useModelsList;
