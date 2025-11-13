import { Select } from "@/components/ui/select";
import {
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { SiAnthropic, SiOpenai, SiOllama, SiGoogle } from "react-icons/si";
import GroqIcon from "@/components/icons/GroqIcon";
import XAIIcon from "../icons/XAIIcon";
import useModel from "@/hooks/useModel";
import { getAuthToken } from "@/lib/utils/auth";
import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { truncateFrom } from "@/lib/utils/format";

function SelectModel({ onModelSelected }: { onModelSelected?: () => void }) {
	const { model, setModel, useModelsEffect, models } = useModel();

	useModelsEffect();

	const handleModelChange = (value: string) => {
		setModel(value);
		onModelSelected?.();
	};

	const getModelIcon = (modelValue: string) => {
		if (modelValue.startsWith("openai:")) {
			return <SiOpenai className="h-4 w-4" />;
		}
		if (modelValue.startsWith("anthropic:")) {
			return <SiAnthropic className="h-4 w-4" />;
		}
		if (modelValue.startsWith("ollama:")) {
			return <SiOllama className="h-4 w-4" />;
		}
		if (modelValue.startsWith("groq:")) {
			return <GroqIcon />;
		}
		if (modelValue.startsWith("xai:")) {
			return <XAIIcon />;
		}
		if (
			modelValue.startsWith("google:") ||
			modelValue.startsWith("google_genai:") ||
			modelValue.startsWith("google-vertexai:")
		) {
			return <SiGoogle className="h-4 w-4" />;
		}
		return null;
	};

	const getModelLabel = (modelValue: string) => {
		return modelValue.split(":")[1] || modelValue;
	};

	const getTruncatedLabel = (label: string) => {
		if (label.length <= 20) return label;
		return truncateFrom(label, "end", "...", 30);
	};

	const authToken = getAuthToken?.();

	return (
		<Select value={model ?? models.default} onValueChange={handleModelChange}>
			<SelectTrigger>
				<SelectValue placeholder="Select Model" />
			</SelectTrigger>
			<SelectContent>
				{models.models.map((modelValue: string) => {
					const disabled =
						!authToken && !models.free.includes(modelValue as string);
					const fullLabel = getModelLabel(modelValue);
					const truncatedLabel = getTruncatedLabel(fullLabel);
					const needsTooltip = fullLabel.length > 20;

					return (
						<SelectItem key={modelValue} value={modelValue} disabled={disabled}>
							{needsTooltip ? (
								<MainToolTip content={fullLabel} delayDuration={300}>
									<div className="flex items-center gap-2">
										{getModelIcon(modelValue)}
										{truncatedLabel}
									</div>
								</MainToolTip>
							) : (
								<div className="flex items-center gap-2">
									{getModelIcon(modelValue)}
									{truncatedLabel}
								</div>
							)}
						</SelectItem>
					);
				})}
			</SelectContent>
		</Select>
	);
}

export default SelectModel;
