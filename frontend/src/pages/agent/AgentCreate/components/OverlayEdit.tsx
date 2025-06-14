import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, X } from "lucide-react";
import useAgentHook from "../hooks/useAgentHook";
import { useChatContext } from "@/context/ChatContext";

function OverlayEdit() {
	const { payload, setPayload } = useChatContext();
	const {
		isGenerating,
		showPromptGenerator,
		setShowPromptGenerator,
		setIsFullscreen,
		promptDescription,
		setPromptDescription,
		handleGeneratePrompt,
	} = useAgentHook();

	return (
		<div className="fixed inset-0 z-50 bg-background p-4 flex flex-col">
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-lg font-medium">Edit System Message</h2>
				<div className="flex items-center gap-2">
					<Button 
						variant="ghost" 
						size="icon" 
						onClick={() => setShowPromptGenerator(!showPromptGenerator)}
						title="Generate system prompt"
					>
						<Wand2 className="h-5 w-5" />
					</Button>
					<Button 
						variant="ghost" 
						size="icon" 
						onClick={() => setIsFullscreen(false)}
					>
						<X className="h-5 w-5" />
					</Button>
				</div>
			</div>

			{showPromptGenerator && (
				<div className="bg-background border rounded-md shadow-md p-4 mb-4">
					<div className="flex flex-col gap-3">
						<div className="text-sm font-medium">Describe what you want the AI to do</div>
						<input
							type="text"
							className="w-full p-2 border rounded text-sm"
							placeholder="e.g., Act as a JavaScript expert"
							value={promptDescription}
							onChange={(e) => setPromptDescription(e.target.value)}
							autoFocus
						/>
						<div className="flex justify-end gap-2">
							<Button 
								variant="outline" 
								size="sm" 
								onClick={() => setShowPromptGenerator(false)}
							>
								Cancel
							</Button>
							<Button 
								variant="outline" 
								size="sm" 
								onClick={() => handleGeneratePrompt('alter')}
								disabled={isGenerating || !promptDescription.trim()}
							>
								{isGenerating ? "Processing..." : "Alter"}
							</Button>
							<Button 
								size="sm" 
								onClick={() => handleGeneratePrompt('replace')}
								disabled={isGenerating || !promptDescription.trim()}
							>
								{isGenerating ? "Processing..." : "Replace"}
							</Button>
						</div>
					</div>
				</div>
			)}

			<Textarea
				placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
				className="flex-1 resize-none h-full"
				value={payload.system}
				onChange={(e) => {
					setPayload({ ...payload, system: e.target.value })
				}}
				autoFocus={!showPromptGenerator}
			/>
		</div>
	)
}

export default OverlayEdit;