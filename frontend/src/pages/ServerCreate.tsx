import TwoColumnLayout from "@/layouts/TwoColumnLayout";
import LeftPanelLayout from "@/layouts/LeftPanelLayout";

function LeftPanel() {
	return (
		<LeftPanelLayout
			title="New Enso"
			status="Draft"
			onCreate={() => {}}
			isCreating={false}
		>
			<div>Left</div>
		</LeftPanelLayout>
	)
}

function ServerCreate() {
  return (
    <TwoColumnLayout
			left={{
				component: <LeftPanel />,
				defaultSize: 30,
				minSize: 30,
			}}
			right={{
				component: <div>Right</div>,
				defaultSize: 70,
				minSize: 30,
			}}
			direction="horizontal"
		/>
  );
}

export default ServerCreate;
