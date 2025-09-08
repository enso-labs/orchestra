import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { Button } from "@/components/ui/button";

const ModalBaseButton = ({
	enabledCount,
	setIsOpen,
	icon,
	label,
}: {
	icon: React.ReactNode;
	enabledCount: number;
	setIsOpen: (isOpen: boolean) => void;
	label: string;
}) => {
	return (
		<MainToolTip content={label} delayDuration={500}>
			<Button
				variant="outline"
				className="rounded-full bg-foreground/10 text-foreground-500 px-3 hover:bg-foreground/15 transition-colors"
				aria-label={label}
				onClick={() => setIsOpen(true)}
			>
				{icon}
				{enabledCount > 0 ? ` (${enabledCount})` : null}
			</Button>
		</MainToolTip>
	);
};

export default ModalBaseButton;
