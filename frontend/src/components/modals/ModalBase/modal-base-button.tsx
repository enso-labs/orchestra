
import { Button } from "@/components/ui/button";

const ModalBaseButton = ({ 
	enabledCount, 
	setIsOpen,
	icon,
}: { 
	icon: React.ReactNode, 
	enabledCount: number, 
	setIsOpen: (isOpen: boolean) => void,
}) => {
  return (
    <Button
      variant="outline"
      className="rounded-full bg-foreground/10 text-foreground-500 px-3 hover:bg-foreground/15 transition-colors"
      aria-label="Select tools for the AI to use"
      onClick={() => setIsOpen(true)}
    >
      {icon}
      {enabledCount > 0 ? ` (${enabledCount})` : null}
    </Button>
  );
}

export default ModalBaseButton;