import { useMemo } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PromptMode } from "@/lib/utils/prompt";

interface PromptModeSelectorProps {
	mode?: PromptMode;
	content: string;
	onModeChange: (mode: PromptMode) => void;
	onContentChange: (value: string) => void;
	disabled?: boolean;
	contentDisabled?: boolean;
	placeholder?: string;
	label?: string;
	description?: string;
	showPreviewHint?: boolean;
}

const MODE_HELP: Record<PromptMode, string> = {
	instructions:
		"Extends the default Ensō system prompt with your custom instructions.",
	system_prompt:
		"Replaces the default Ensō system prompt entirely with your own text.",
};

export const PromptModeSelector = ({
	mode,
	content,
	onModeChange,
	onContentChange,
	disabled = false,
	contentDisabled = false,
	placeholder,
	label = "Prompt Configuration",
	description,
	showPreviewHint = false,
}: PromptModeSelectorProps) => {
	const currentMode = mode || "instructions";
	const badges = useMemo(
		() => ({
			instructions: <Badge variant="secondary">Extends default</Badge>,
			system_prompt: <Badge variant="destructive">Overrides default</Badge>,
		}),
		[],
	);

	const handleModeChange = (nextMode: PromptMode) => {
		if (disabled) return;
		if (nextMode === currentMode) return;
		onModeChange(nextMode);
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm font-medium">{label}</p>
					{description && (
						<p className="text-xs text-muted-foreground">{description}</p>
					)}
				</div>
				{badges[mode]}
			</div>

			<RadioGroup
				value={currentMode}
				onValueChange={(value) => handleModeChange(value as PromptMode)}
				className="grid grid-cols-1 md:grid-cols-2 gap-3"
				aria-disabled={disabled}
			>
				<div
					className="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
					onClick={() => handleModeChange("instructions")}
				>
					<RadioGroupItem value="instructions" id="instructions" />
					<div className="space-y-1">
						<Label htmlFor="instructions" className="flex items-center gap-2">
							Instructions
						</Label>
						<p className="text-xs text-muted-foreground">{MODE_HELP.instructions}</p>
					</div>
				</div>

				<div
					className="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
					onClick={() => handleModeChange("system_prompt")}
				>
					<RadioGroupItem value="system_prompt" id="system_prompt" />
					<div className="space-y-1">
						<Label htmlFor="system_prompt" className="flex items-center gap-2">
							System Prompt Override
						</Label>
						<p className="text-xs text-muted-foreground">{MODE_HELP.system_prompt}</p>
					</div>
				</div>
			</RadioGroup>

			<Textarea
				disabled={contentDisabled}
				value={content}
				onChange={(e) => onContentChange(e.target.value)}
				placeholder={
					placeholder ||
					(mode === "instructions"
						? "Add instructions to extend the default prompt..."
						: "Provide a full system prompt to override the default...")
				}
			/>
			{showPreviewHint && mode === "instructions" && (
				<p className="text-xs text-muted-foreground">
					Ensō will combine these instructions with the default system prompt template.
				</p>
			)}
		</div>
	);
};
