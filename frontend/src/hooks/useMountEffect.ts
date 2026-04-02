import { useEffect } from "react";

/**
 * Semantic wrapper for useEffect with empty dependency array.
 * Use for one-time mount setup (DOM manipulation, third-party init, subscriptions).
 * Centralizes the eslint-disable so callers don't need to suppress individually.
 */
export function useMountEffect(fn: () => void | (() => void)) {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(fn, []);
}
