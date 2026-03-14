import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/drawers/app-sidebar";
import Joyride from "react-joyride";
import { useOnboarding } from "@/context/OnboardingContext";
import { onboardingSteps } from "@/lib/config/onboardingSteps";

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
				spotlightClicks
				callback={handleJoyrideCallback}
				styles={{
					options: {
						zIndex: 10000,
						primaryColor: "hsl(var(--primary))",
						backgroundColor: "hsl(var(--card))",
						textColor: "hsl(var(--card-foreground))",
						arrowColor: "hsl(var(--card))",
					},
					tooltip: { borderRadius: "0.75rem" },
					buttonNext: { borderRadius: "0.5rem" },
					buttonBack: { color: "hsl(var(--muted-foreground))" },
					buttonSkip: { color: "hsl(var(--muted-foreground))" },
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
