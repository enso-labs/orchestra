import { Dialog, DialogContent } from "@/components/ui/dialog";
import ModalBaseButton from "./modal-base-button";

function ModalBase({
	content,
	icon,
	enabledCount,
	isOpen,
	setIsOpen,
	label,
}: {
	content: React.ReactNode,
	icon: React.ReactNode,
	enabledCount: number,
	isOpen: boolean,
	setIsOpen: (isOpen: boolean) => void,
	label: string,
}) {

	return (
		<>
			<ModalBaseButton icon={icon} enabledCount={enabledCount} setIsOpen={setIsOpen} label={label} />
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="max-w-screen-lg p-0">
					{content}
				</DialogContent>
			</Dialog>
		</>
	)
}

export default ModalBase;