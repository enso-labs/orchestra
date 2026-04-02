import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/utils/apiClient";
import { queryKeys } from "@/lib/queryKeys";

interface SandboxHealthResult {
	isHealthy: boolean | null;
	isLoading: boolean;
	refresh: () => void;
}

const noop = () => {};

/**
 * Checks MCP sandbox health via backend proxy endpoint.
 * The backend makes the actual request to the sandbox (avoids CORS / Docker networking issues).
 */
export function useSandboxHealth(
	mcpSandboxUrl: string | null,
): SandboxHealthResult {
	const queryClient = useQueryClient();

	const { data, isLoading, isError, isFetched } = useQuery({
		queryKey: queryKeys.sandboxHealth(mcpSandboxUrl),
		queryFn: async (): Promise<boolean> => {
			await apiClient.get("/settings/mcp-sandbox-health");
			return true;
		},
		enabled: !!mcpSandboxUrl,
		retry: false,
		staleTime: 30 * 1000, // 30 seconds
	});

	const refresh = () => {
		if (mcpSandboxUrl) {
			queryClient.invalidateQueries({
				queryKey: queryKeys.sandboxHealth(mcpSandboxUrl),
			});
		}
	};

	if (!mcpSandboxUrl) {
		return { isHealthy: null, isLoading: false, refresh: noop };
	}

	const isHealthy = !isFetched ? null : isError ? false : (data ?? null);

	return { isHealthy, isLoading, refresh };
}
