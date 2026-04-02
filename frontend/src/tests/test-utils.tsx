import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

/**
 * Creates a fresh QueryClient for tests and returns a wrapper component.
 * Use with renderHook: renderHook(() => useMyHook(), { wrapper: createQueryWrapper() })
 */
export function createQueryWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
			},
		},
	});

	return function QueryWrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}
