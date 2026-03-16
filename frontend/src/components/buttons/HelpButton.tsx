import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/context/OnboardingContext";

export function HelpButton() {
	const { run, toggleTour } = useOnboarding();

	return (
		<Button
			variant={run ? "default" : "outline"}
			size="icon"
			className="relative z-[10001] h-9 w-9"
			onClick={toggleTour}
			aria-label="Help tour"
			title={run ? "Stop tour" : "Replay onboarding tour"}
			data-tour="help-button"
		>
			<HelpCircle className="h-4 w-4" />
		</Button>
	);
}
