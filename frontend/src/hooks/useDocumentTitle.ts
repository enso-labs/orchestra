import { useEffect, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { useBranding } from "@/context/BrandingContext";

export type TitleStatus = "idle" | "streaming" | "done";

const DONE_TIMEOUT_MS = 3000;

/**
 * Hook that updates the browser tab title based on streaming status.
 * Derives status from AppContext loading state and the brand from BrandingContext.
 *
 * @returns Object containing the current title status
 */
export function useDocumentTitle(): { status: TitleStatus } {
	const { loading } = useAppContext();
	const branding = useBranding();
	const prevLoadingRef = useRef<boolean | undefined>(undefined);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const statusRef = useRef<TitleStatus>("idle");

	const defaultTitle = branding.brand.title;
	const brandName = branding.brand.name;
	// Keep the latest idle title for the unmount reset without re-subscribing.
	const idleTitleRef = useRef(defaultTitle);
	idleTitleRef.current = defaultTitle;

	useEffect(() => {
		const titleMap: Record<TitleStatus, string> = {
			idle: defaultTitle,
			streaming: `[Streaming...] ${brandName}`,
			done: `[Done] ${brandName}`,
		};

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
				document.title = titleMap.idle;
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
			document.title = titleMap[newStatus];
		}

		prevLoadingRef.current = isLoading;

		return () => {
			clearDoneTimeout();
		};
	}, [loading, defaultTitle, brandName]);

	useEffect(() => {
		return () => {
			document.title = idleTitleRef.current;
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return { status: statusRef.current };
}
