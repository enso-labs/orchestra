import { useCallback, useEffect, useRef, useState } from "react";
import introJs from "intro.js";
import "intro.js/introjs.css";

type TooltipPosition =
	| "floating"
	| "top"
	| "bottom"
	| "left"
	| "right"
	| "top-right-aligned"
	| "top-left-aligned"
	| "top-middle-aligned"
	| "bottom-right-aligned"
	| "bottom-left-aligned"
	| "bottom-middle-aligned";

export interface IntroTourStep {
	element?: string | HTMLElement;
	intro: string;
	position?: TooltipPosition;
	title?: string;
}

export interface UseIntroTourOptions {
	autoStart?: boolean;
	exitOnOverlayClick?: boolean;
	showProgress?: boolean;
	showBullets?: boolean;
}

const STORAGE_PREFIX = "orchestra:tour:";

function getDismissalKey(tourId: string): string {
	return `${STORAGE_PREFIX}${tourId}:dismissed`;
}

function isDismissed(tourId: string): boolean {
	return localStorage.getItem(getDismissalKey(tourId)) === "true";
}

function setDismissed(tourId: string, dismissed: boolean): void {
	if (dismissed) {
		localStorage.setItem(getDismissalKey(tourId), "true");
	} else {
		localStorage.removeItem(getDismissalKey(tourId));
	}
}

export function useIntroTour(
	tourId: string,
	steps: IntroTourStep[],
	options?: UseIntroTourOptions
) {
	const [isComplete, setIsComplete] = useState(() => isDismissed(tourId));
	const tourRef = useRef<ReturnType<typeof introJs.tour> | null>(null);
	const hasAutoStarted = useRef(false);

	const startTour = useCallback(() => {
		const tour = introJs.tour();

		tour.setOptions({
			steps: steps.map((s) => ({
				element: s.element,
				intro: s.intro,
				position: s.position ?? "bottom",
				title: s.title ?? "",
			})),
			exitOnOverlayClick: options?.exitOnOverlayClick ?? true,
			showProgress: options?.showProgress ?? true,
			showBullets: options?.showBullets ?? false,
			dontShowAgain: false,
		});

		tour.onComplete(() => {
			setDismissed(tourId, true);
			setIsComplete(true);
			tourRef.current = null;
		});

		tour.onExit(() => {
			setDismissed(tourId, true);
			setIsComplete(true);
			tourRef.current = null;
		});

		tourRef.current = tour;
		tour.start();
	}, [tourId, steps, options]);

	const resetTour = useCallback(() => {
		setDismissed(tourId, false);
		setIsComplete(false);
		hasAutoStarted.current = false;
	}, [tourId]);

	useEffect(() => {
		if (
			options?.autoStart &&
			!isDismissed(tourId) &&
			!hasAutoStarted.current
		) {
			hasAutoStarted.current = true;
			startTour();
		}
	}, [options?.autoStart, tourId, startTour]);

	useEffect(() => {
		return () => {
			if (tourRef.current) {
				tourRef.current.exit(true);
				tourRef.current = null;
			}
		};
	}, []);

	return { startTour, isComplete, resetTour };
}
