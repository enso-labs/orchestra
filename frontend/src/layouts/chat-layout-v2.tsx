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
				styles={{ options: { zIndex: 10000 } }}
			/>
			<AppSidebar />
			<main className="flex-1 flex flex-col max-h-screen overflow-hidden">
				{children}
			</main>
		</SidebarProvider>
	);
}

export default ChatLayout;
