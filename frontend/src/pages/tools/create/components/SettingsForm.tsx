import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Wand2, Maximize2 } from "lucide-react";
import SelectModel from "@/components/selects/SelectModel";
import PromptGenerator from "./PromptGenerator";
import { AgentDetails, GenerateMode } from "../types";

interface SettingsFormProps {
	agentDetails: AgentDetails;
	onUpdateAgentDetails: (details: AgentDetails) => void;
	systemMessage: string;
	onUpdateSystemMessage: (message: string) => void;
	showPromptGenerator: boolean;
	onTogglePromptGenerator: () => void;
	onToggleFullscreen: () => void;
	onGeneratePrompt: (mode: GenerateMode, description: string) => void;
	isGenerating: boolean;
}

export default function SettingsForm({
	agentDetails,
	onUpdateAgentDetails,
	systemMessage,
	onUpdateSystemMessage,
	showPromptGenerator,
	onTogglePromptGenerator,
	onToggleFullscreen,
	onGeneratePrompt,
	isGenerating,
}: SettingsFormProps) {
	return (
		<div className="space-y-4 max-w-full">
			<div>
				<label className="block mb-2 text-sm font-medium">Name</label>
				<Input
					placeholder="Name your Enso"
					className="bg-secondary/50 border-border"
					value={agentDetails.name}
					onChange={(e) =>
						onUpdateAgentDetails({ ...agentDetails, name: e.target.value })
					}
				/>
			</div>

			<div>
				<label className="block mb-2 text-sm font-medium">Description</label>
				<Textarea
					placeholder="Add a short description about what this Enso does"
					className="bg-secondary/50 border-border resize-none"
					rows={2}
					value={agentDetails.description}
					onChange={(e) =>
						onUpdateAgentDetails({
							...agentDetails,
							description: e.target.value,
						})
					}
				/>
			</div>

			<div>
				<label className="block mb-2 text-sm font-medium">System Message</label>
				<div className="relative">
					<Textarea
						placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
						className="bg-secondary/50 border-border resize-none"
						rows={10}
						value={systemMessage}
						onChange={(e) => onUpdateSystemMessage(e.target.value)}
					/>
					<div className="flex justify-end mt-1 gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="h-5 w-5"
							onClick={onTogglePromptGenerator}
							title="Generate system prompt"
						>
							<Wand2 className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-5 w-5"
							onClick={onToggleFullscreen}
						>
							<Maximize2 className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{showPromptGenerator && (
					<div className="mt-2">
						<PromptGenerator
							onGenerate={onGeneratePrompt}
							onCancel={onTogglePromptGenerator}
							isGenerating={isGenerating}
						/>
					</div>
				)}
			</div>

			<div>
				<label className="block mb-2 text-sm font-medium">Model</label>
				<SelectModel />
			</div>
		</div>
	);
}
