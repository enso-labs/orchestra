import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

const ModalButton = ({
	enabledCount,
	setIsOpen,
}: {
	enabledCount: number;
	setIsOpen: (isOpen: boolean) => void;
}) => {
	return (
		<Button
			variant="outline"
			className="rounded-full bg-foreground/10 text-foreground-500 px-3 hover:bg-foreground/15 transition-colors"
			aria-label="Select tools for the AI to use"
			onClick={() => setIsOpen(true)}
		>
			<Wrench className="h-4 w-4" />
			{enabledCount > 0 ? ` (${enabledCount})` : null}
		</Button>
	);
};

export default ModalButton;
