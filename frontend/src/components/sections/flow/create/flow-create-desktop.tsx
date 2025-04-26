import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import FlowCanvas from "@/components/canvas/FlowCanvas"
import AgentCreateForm from "@/components/forms/AgentCreateForm"

function FlowCreateDesktop({
	navigate,
	processCreateAgent,
	isCreating,
	agentDetails,
	setAgentDetails,
	payload,
	setPayload,
	showPromptGenerator,
	setShowPromptGenerator,
	setIsFullscreen,
	promptDescription,
	setPromptDescription,
	conversationStarters,
	setConversationStarters,
	handleAddConversationStarter,
	handleRemoveConversationStarter,
	handleGeneratePrompt,
	isGenerating,
}: {
	activeTab: string;
	setActiveTab: (tab: string) => void;
	navigate: (path: string) => void;
	processCreateAgent: () => void;
	isCreating: boolean;
	agentDetails: {
		name: string;
		description: string;
		model: string;
		system: string;
	};
	setAgentDetails: (details: { name: string; description: string; model?: string; system?: string }) => void;
	payload: {
		model: string;
		system: string;
	};
	setPayload: (payload: { model: string; system: string }) => void;
	showPromptGenerator: boolean;
	setShowPromptGenerator: (show: boolean) => void;
	setIsFullscreen: (isFullscreen: boolean) => void;
	promptDescription: string;
	setPromptDescription: (promptDescription: string) => void;
	conversationStarters: string[];
	setConversationStarters: (conversationStarters: string[]) => void;
	handleAddConversationStarter: () => void;
	handleRemoveConversationStarter: (index: number) => void;
	handleGeneratePrompt: (mode: 'replace' | 'alter') => void;
	isGenerating: boolean;
}) {
	return (
		<div className="hidden md:block h-screen w-full">
			<ResizablePanelGroup
				direction="horizontal"
				className="w-full h-full bg-background text-foreground"
			>
				{/* Left panel - Settings */}
				<ResizablePanel defaultSize={30} minSize={30}>
					<AgentCreateForm
						navigate={navigate}
						processCreateAgent={processCreateAgent}
						isCreating={isCreating}
						agentDetails={agentDetails}
						setAgentDetails={setAgentDetails}
						payload={payload}
						setPayload={setPayload}
						showPromptGenerator={showPromptGenerator}
						setShowPromptGenerator={setShowPromptGenerator}
						setIsFullscreen={setIsFullscreen}
						promptDescription={promptDescription}
						setPromptDescription={setPromptDescription}
						conversationStarters={conversationStarters}
						setConversationStarters={setConversationStarters}
						handleAddConversationStarter={handleAddConversationStarter}
						handleRemoveConversationStarter={handleRemoveConversationStarter}
						handleGeneratePrompt={handleGeneratePrompt}
						isGenerating={isGenerating}
					/>
				</ResizablePanel>
				
				<ResizableHandle withHandle />
				
				{/* Right panel - Preview */}
				<ResizablePanel defaultSize={70} minSize={30}>
					<FlowCanvas />
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	)
}

export default FlowCreateDesktop;