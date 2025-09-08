import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import FlowCanvas from "@/components/canvas/FlowCanvas";
import FlowEditForm from "@/components/forms/FlowEditForm";
import LeftPanelLayout from "@/layouts/LeftPanelLayout";

function FlowCreateDesktop({
	processCreateAgent,
	loading,
}: {
	processCreateAgent: () => void;
	loading: boolean;
}) {
	return (
		<div className="hidden md:block h-screen w-full">
			<ResizablePanelGroup
				direction="horizontal"
				className="w-full h-full bg-background text-foreground"
			>
				{/* Left panel - Settings */}
				<ResizablePanel defaultSize={30} minSize={30}>
					<LeftPanelLayout onCreate={processCreateAgent} loading={loading}>
						<FlowEditForm />
					</LeftPanelLayout>
				</ResizablePanel>

				<ResizableHandle withHandle />

				{/* Right panel - Preview */}
				<ResizablePanel defaultSize={70} minSize={30}>
					<FlowCanvas />
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

export default FlowCreateDesktop;
