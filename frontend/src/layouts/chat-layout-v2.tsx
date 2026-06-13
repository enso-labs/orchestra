import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/drawers/app-sidebar";
import Joyride from "react-joyride";
import { useOnboarding } from "@/context/OnboardingContext";
import { onboardingSteps } from "@/lib/config/onboardingSteps";
import { JoyrideTooltip } from "@/components/tooltips/JoyrideTooltip";

export function ChatLayout({ children }: { children: React.ReactNode }) {
	const defaultOpen = true;
	const { run, stepIndex, handleJoyrideCallback } = useOnboarding();

	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<Joyride
				steps={onboardingSteps}
				run={run}
				stepIndex={stepIndex}
				continuous
				showSkipButton
				showProgress
				disableOverlayClose={false}
				disableScrolling
				spotlightClicks
				callback={handleJoyrideCallback}
				tooltipComponent={JoyrideTooltip}
				floaterProps={{
					hideArrow: true,
					styles: { floater: { maxWidth: "calc(100vw - 1rem)" } },
				}}
				styles={{
					// Darker dim + a vivid spotlight ring so the highlighted target
					// is clearly distinguishable in both light and dark themes — a
					// 0.5 dim over the dark UI left the highlighted element invisible.
					options: { zIndex: 10000, overlayColor: "rgba(0, 0, 0, 0.7)" },
					spotlight: {
						border: "3px solid #38bdf8",
						borderRadius: "10px",
					},
				}}
			/>
			<AppSidebar />
			<main className="flex-1 flex flex-col max-h-screen overflow-hidden">
				{children}
			</main>
		</SidebarProvider>
	);
}

export default ChatLayout;
