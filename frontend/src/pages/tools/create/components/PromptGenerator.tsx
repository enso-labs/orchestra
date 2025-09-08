import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GenerateMode } from "../types";

interface PromptGeneratorProps {
	onGenerate: (mode: GenerateMode, description: string) => void;
	onCancel: () => void;
	isGenerating: boolean;
}

export default function PromptGenerator({
	onGenerate,
	onCancel,
	isGenerating,
}: PromptGeneratorProps) {
	const [promptDescription, setPromptDescription] = useState("");

	const handleGenerate = (mode: GenerateMode) => {
		if (!promptDescription.trim()) return;
		onGenerate(mode, promptDescription);
		setPromptDescription("");
	};

	return (
		<div className="bg-background border rounded-md shadow-md p-3">
			<div className="flex flex-col gap-2">
				<div className="text-xs font-medium">
					Describe what you want the AI to do
				</div>
				<input
					type="text"
					className="w-full p-2 border rounded text-sm"
					placeholder="e.g., Act as a JavaScript expert"
					value={promptDescription}
					onChange={(e) => setPromptDescription(e.target.value)}
					autoFocus
				/>
				<div className="flex justify-end gap-2">
					<Button variant="outline" size="sm" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleGenerate("alter")}
						disabled={isGenerating || !promptDescription.trim()}
					>
						{isGenerating ? "Processing..." : "Alter"}
					</Button>
					<Button
						size="sm"
						onClick={() => handleGenerate("replace")}
						disabled={isGenerating || !promptDescription.trim()}
					>
						{isGenerating ? "Processing..." : "Replace"}
					</Button>
				</div>
			</div>
		</div>
	);
}
