import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/context/OnboardingContext";

export function HelpButton() {
	const { startTour } = useOnboarding();

	return (
		<Button
			variant="outline"
			size="icon"
			className="h-9 w-9"
			onClick={startTour}
			aria-label="Help tour"
			title="Replay onboarding tour"
			data-tour="help-button"
		>
			<HelpCircle className="h-4 w-4" />
		</Button>
	);
}
