import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";

interface TwoColumnLayoutProps {
	left: {
		component: React.ReactNode;
		defaultSize: number;
		minSize: number;
	};
	right: {
		component: React.ReactNode;
		defaultSize: number;
		minSize: number;
	};
	direction?: "horizontal" | "vertical";
	className?: string;
}

export function TwoColumnLayout({
	left,
	right,
	direction = "horizontal",
	className = "w-full h-full bg-background text-foreground",
}: TwoColumnLayoutProps) {
	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			<div className="hidden md:block h-screen w-full">
				<ResizablePanelGroup direction={direction} className={className}>
					{/* Left panel - Settings */}
					<ResizablePanel defaultSize={left.defaultSize} minSize={left.minSize}>
						{left.component}
					</ResizablePanel>

					<ResizableHandle withHandle />

					{/* Right panel - Preview */}
					<ResizablePanel
						defaultSize={right.defaultSize}
						minSize={right.minSize}
					>
						{right.component}
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</div>
	);
}

export default TwoColumnLayout;
