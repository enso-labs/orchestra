import { useQuery } from "@tanstack/react-query";
import { listModels, ModelsResponse } from "@/lib/services/modelService";
import { getAuthToken } from "@/lib/utils/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { queryKeys } from "@/lib/queryKeys";
import {
	notifyConnectionLost,
	notifyConnectionRestored,
} from "@/lib/utils/connectionToast";

const EMPTY_MODELS: ModelsResponse = { default: "", free: [], models: [] };

export function useModel() {
	const [model, setModelState] = useState<string | null>(null);

	const {
		data: models = EMPTY_MODELS,
		isLoading,
		isError,
		isFetching,
		isSuccess,
		refetch,
	} = useQuery({
		queryKey: queryKeys.models(),
		queryFn: () => listModels().then((r) => r.data),
		enabled: !!getAuthToken(),
		// Local override, not a change to the global default in lib/queryClient.ts.
		// apiClient already retries once itself, and queryClient retries again on
		// top; compounded with the request timeout that is ~40s before `isError`
		// ever flips — far past the point a user has given up on the picker.
		retry: 0,
		// Global default is false. Recovery from an outage should be hands-free.
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
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

	// Notify on the *transition* into and out of the error state, never on
	// every render. main.tsx is <StrictMode>, so effects double-invoke in dev;
	// the ref plus the shared toast id keep this idempotent.
	//
	// This hook is the single owner of the connection notification.
	// hooks/useModelsList.ts observes the same query key and deliberately does
	// not carry this effect — one owner per notification.
	const hasNotifiedRef = useRef(false);
	useEffect(() => {
		if (isError && !hasNotifiedRef.current) {
			hasNotifiedRef.current = true;
			notifyConnectionLost(() => {
				refetch();
			});
		} else if (isSuccess && hasNotifiedRef.current) {
			hasNotifiedRef.current = false;
			notifyConnectionRestored();
		}
	}, [isError, isSuccess, refetch]);

	// Display-only model: shows what will be used without sending it in payloads
	const displayModel = model || models.default || null;

	return {
		model,
		setModel,
		updateQueryStateModel,
		resetToDefault,
		displayModel,
		models,
		isLoading,
		isError,
		isFetching,
		refetch,
		useModelsEffect,
	};
}

export default useModel;
