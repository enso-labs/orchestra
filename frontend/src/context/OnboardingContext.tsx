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

interface OnboardingContextValue {
	run: boolean;
	stepIndex: number;
	startTour: () => void;
	handleJoyrideCallback: (data: CallBackProps) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

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
								setRun(true);
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
					setRun(true);
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

	const startTour = useCallback(() => {
		setStepIndex(0);
		setRun(true);
	}, []);

	const handleJoyrideCallback = useCallback(
		(data: CallBackProps) => {
			const { action, index, status, type } = data;

			if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
				setRun(false);
				setStepIndex(0);
				markComplete();
				return;
			}

			if (type === EVENTS.STEP_AFTER) {
				setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
			}

			if (type === EVENTS.TARGET_NOT_FOUND) {
				setStepIndex(index + 1);
			}
		},
		[markComplete],
	);

	return (
		<OnboardingContext.Provider
			value={{
				run: run && checked,
				stepIndex,
				startTour,
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
