import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { CallBackProps } from "react-joyride";
import { ACTIONS, EVENTS, STATUS } from "react-joyride";
import { getSettings, patchDefaults } from "@/lib/services/userSettingsService";
import { getAuthToken } from "@/lib/utils/auth";
import { onboardingSteps } from "@/lib/config/onboardingSteps";

interface OnboardingContextValue {
	run: boolean;
	stepIndex: number;
	toggleTour: () => void;
	handleJoyrideCallback: (data: CallBackProps) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Find the next step index (starting from `from`) whose target exists in the DOM. */
function findNextVisibleStep(from: number, direction: 1 | -1 = 1): number {
	for (let i = from; i >= 0 && i < onboardingSteps.length; i += direction) {
		const target = onboardingSteps[i].target;
		if (typeof target === "string" && document.querySelector(target)) {
			return i;
		}
	}
	return -1;
}

export function OnboardingProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [run, setRun] = useState(false);
	const [stepIndex, setStepIndex] = useState(0);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		if (!getAuthToken()) {
			// Not logged in yet — poll until token appears
			const interval = setInterval(() => {
				if (getAuthToken()) {
					clearInterval(interval);
					getSettings()
						.then((settings) => {
							if (!settings.defaults.onboarding_completed) {
								const first = findNextVisibleStep(0);
								if (first !== -1) {
									setStepIndex(first);
									setRun(true);
								}
							}
							setChecked(true);
						})
						.catch(() => {
							setChecked(true);
						});
				}
			}, 1000);
			return () => clearInterval(interval);
		}
		getSettings()
			.then((settings) => {
				if (!settings.defaults.onboarding_completed) {
					const first = findNextVisibleStep(0);
					if (first !== -1) {
						setStepIndex(first);
						setRun(true);
					}
				}
				setChecked(true);
			})
			.catch(() => {
				setChecked(true);
			});
	}, []);

	const markComplete = useCallback(() => {
		patchDefaults({ onboarding_completed: true }).catch(() => {});
	}, []);

	const toggleTour = useCallback(() => {
		if (run) {
			setRun(false);
			setStepIndex(0);
			window.scrollTo(0, 0);
			return;
		}
		window.scrollTo(0, 0);
		const first = findNextVisibleStep(0);
		if (first === -1) return;
		setStepIndex(first);
		setRun(true);
	}, [run]);

	const handleJoyrideCallback = useCallback(
		(data: CallBackProps) => {
			const { action, index, status, type } = data;

			if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
				setRun(false);
				setStepIndex(0);
				markComplete();
				return;
			}

			if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
				const direction = action === ACTIONS.PREV ? -1 : 1;
				const next = findNextVisibleStep(
					index + direction,
					direction as 1 | -1,
				);
				if (next === -1) {
					setRun(false);
					setStepIndex(0);
					markComplete();
				} else {
					setStepIndex(next);
				}
			}
		},
		[markComplete],
	);

	return (
		<OnboardingContext.Provider
			value={{
				run: run && checked,
				stepIndex,
				toggleTour,
				handleJoyrideCallback,
			}}
		>
			{children}
		</OnboardingContext.Provider>
	);
}

export function useOnboarding() {
	const ctx = useContext(OnboardingContext);
	if (!ctx) {
		throw new Error("useOnboarding must be used within OnboardingProvider");
	}
	return ctx;
}
