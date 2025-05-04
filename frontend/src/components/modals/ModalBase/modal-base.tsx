import { Dialog, DialogContent } from "@/components/ui/dialog";
import ModalBaseButton from "./modal-base-button";

function ModalBase({
	content,
	icon,
	enabledCount,
	isOpen,
	setIsOpen,
}: {
	content: React.ReactNode,
	icon: React.ReactNode,
	enabledCount: number,
	isOpen: boolean,
	setIsOpen: (isOpen: boolean) => void,
}) {

	return (
		<>
			<ModalBaseButton icon={icon} enabledCount={enabledCount} setIsOpen={setIsOpen} />
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="max-w-screen-lg p-0">
					{content}
				</DialogContent>
			</Dialog>
		</>
	)
}

export default ModalBase;