import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/utils/apiClient";

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
	const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	const check = useCallback(() => {
		if (!mcpSandboxUrl) {
			setIsHealthy(null);
			return;
		}

		// Abort any in-flight request
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setIsLoading(true);

		apiClient
			.get("/settings/mcp-sandbox-health", {
				signal: controller.signal,
			})
			.then(() => {
				if (!controller.signal.aborted) setIsHealthy(true);
			})
			.catch(() => {
				if (!controller.signal.aborted) setIsHealthy(false);
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
	}, [mcpSandboxUrl]);

	// Check on mount when URL is present
	useEffect(() => {
		if (mcpSandboxUrl) {
			check();
		} else {
			setIsHealthy(null);
		}

		return () => {
			abortRef.current?.abort();
		};
	}, [mcpSandboxUrl, check]);

	if (!mcpSandboxUrl) {
		return { isHealthy: null, isLoading: false, refresh: noop };
	}

	return { isHealthy, isLoading, refresh: check };
}
