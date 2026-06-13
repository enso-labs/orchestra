import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/context/OnboardingContext";

export function HelpButton() {
	const { run, toggleTour } = useOnboarding();

	return (
		<Button
			variant={run ? "default" : "outline"}
			size="icon"
			// Only float above the tour overlay (z-10000) while the tour is
			// running; otherwise keep normal stacking so the button doesn't
			// overlay the Files drawer / editor and other panels.
			className={cn("relative h-9 w-9", run && "z-[10001]")}
			onClick={toggleTour}
			aria-label="Help tour"
			title={run ? "Stop tour" : "Replay onboarding tour"}
			data-tour="help-button"
		>
			<HelpCircle className="h-4 w-4" />
		</Button>
	);
}
