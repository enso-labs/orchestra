import { toast } from "sonner";

/**
 * One fixed id for every connection-class notification.
 *
 * Sonner keyed by `id` replaces in place rather than stacking, so N queries
 * failing concurrently render exactly one toast. This is the load-bearing
 * dedupe mechanism — do not vary it per call site.
 */
export const CONNECTION_TOAST_ID = "connection-lost";

/**
 * True when an error never got an HTTP response — a transport failure
 * (server down, DNS, CORS, timeout) rather than a 4xx/5xx the server sent.
 *
 * Callers use this to decide between the shared connection toast and their
 * own specific message: a 404 on one resource is not an outage.
 */
export function isNetworkError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const candidate = error as {
		isAxiosError?: boolean;
		response?: unknown;
		code?: string;
	};
	if (candidate.response) return false;
	return (
		candidate.isAxiosError === true ||
		candidate.code === "ERR_NETWORK" ||
		candidate.code === "ECONNABORTED"
	);
}

/**
 * Announce that the server is unreachable.
 *
 * Deliberately not `duration: Infinity`. The `Infinity` precedent in
 * `hooks/useChat.ts` reports terminal failure of an action the user just took;
 * this is an ambient condition whose persistent signal is the inline
 * "Models unavailable" chip in the composer.
 *
 * The title is deliberately generic. Because every caller shares one id, only
 * one of them can ever be on screen, so a models-specific title would be a
 * lie whenever another settings surface happens to lose the race.
 */
export function notifyConnectionLost(onRetry?: () => void) {
	toast.error("Failed to reach the server", {
		id: CONNECTION_TOAST_ID,
		description:
			"The server could not be reached. Some controls are unavailable until it responds.",
		duration: 6000,
		dismissible: true,
		...(onRetry ? { action: { label: "Retry", onClick: onRetry } } : {}),
	});
}

/**
 * Announce recovery. Sharing `CONNECTION_TOAST_ID` means this replaces the
 * error toast rather than stacking a contradictory pair beside it.
 */
export function notifyConnectionRestored() {
	toast.success("Connection restored", {
		id: CONNECTION_TOAST_ID,
		duration: 4000,
		// Replacing by id merges into the existing toast, so the error's
		// description and Retry action survive unless they are explicitly
		// cleared — which reads as "Connection restored / the server could not
		// be reached".
		description: undefined,
		action: undefined,
	});
}
