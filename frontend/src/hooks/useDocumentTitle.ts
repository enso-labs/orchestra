import { useEffect, useRef } from "react";
import { useAppContext } from "@/context/AppContext";

export type TitleStatus = "idle" | "streaming" | "done";

const DEFAULT_TITLE = "Ruska AI";
const DONE_TIMEOUT_MS = 3000;

const TITLE_MAP: Record<TitleStatus, string> = {
	idle: DEFAULT_TITLE,
	streaming: `[Streaming...] ${DEFAULT_TITLE}`,
	done: `[Done] ${DEFAULT_TITLE}`,
};

/**
 * Hook that updates the browser tab title based on streaming status.
 * Derives status from AppContext loading state.
 *
 * @returns Object containing the current title status
 */
export function useDocumentTitle(): { status: TitleStatus } {
	const { loading } = useAppContext();
	const prevLoadingRef = useRef<boolean | undefined>(undefined);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const statusRef = useRef<TitleStatus>("idle");

	useEffect(() => {
		const isLoading = loading === true;
		const wasLoading = prevLoadingRef.current === true;

		const clearDoneTimeout = () => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};

		let newStatus: TitleStatus;

		if (isLoading) {
			clearDoneTimeout();
			newStatus = "streaming";
		} else if (wasLoading && !isLoading) {
			clearDoneTimeout();
			newStatus = "done";

			timeoutRef.current = setTimeout(() => {
				statusRef.current = "idle";
				document.title = TITLE_MAP.idle;
				timeoutRef.current = null;
			}, DONE_TIMEOUT_MS);
		} else {
			newStatus = statusRef.current === "done" ? "done" : "idle";
		}

		if (
			newStatus !== statusRef.current ||
			prevLoadingRef.current === undefined
		) {
			statusRef.current = newStatus;
			document.title = TITLE_MAP[newStatus];
		}

		prevLoadingRef.current = isLoading;

		return () => {
			clearDoneTimeout();
		};
	}, [loading]);

	useEffect(() => {
		return () => {
			document.title = TITLE_MAP.idle;
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return { status: statusRef.current };
}
