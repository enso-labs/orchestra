import { useCallback, useEffect, useRef, useState } from "react";

interface SandboxHealthResult {
	isHealthy: boolean | null;
	isLoading: boolean;
	refresh: () => void;
}

const noop = () => {};

/**
 * Pings the health endpoint derived from the user's MCP sandbox URL.
 * Health endpoint: strip trailing /mcp suffix, append /health.
 */
function deriveHealthUrl(mcpUrl: string): string {
	const base = mcpUrl.replace(/\/mcp\/?$/, "");
	return `${base}/health`;
}

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
		const healthUrl = deriveHealthUrl(mcpSandboxUrl);

		fetch(healthUrl, { signal: controller.signal })
			.then((res) => {
				if (!res.ok) throw new Error("not ok");
				return res.json();
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
