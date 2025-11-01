import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import SelectModel from "../lists/SelectModel";
import NewThreadButton from "../buttons/NewThreadButton";


export function ChatNav({ sidebarTrigger }: { sidebarTrigger?: React.ReactNode | undefined }) {
	return (
		<header className="bg-transparent mb-1">
			<div className="mx-auto px-4 sm:px-6 lg:px-4 pt-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center">
						{sidebarTrigger}
					</div>

					<div className="flex items-center gap-2">
						<div className="w-56">
							<SelectModel />
						</div>
						<NewThreadButton />
						<div className="w-9">
							<ColorModeButton />
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
