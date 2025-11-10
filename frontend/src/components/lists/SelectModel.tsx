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

	const authToken = getAuthToken?.();

	return (
		<Select
			value={model ?? models.default}
			onValueChange={handleModelChange}
		>
			<SelectTrigger>
				<SelectValue placeholder="Select Model" />
			</SelectTrigger>
			<SelectContent>
				{models.models.map((modelValue: string) => {
					const disabled =
						!authToken && !models.free.includes(modelValue as string);
					return (
						<SelectItem key={modelValue} value={modelValue} disabled={disabled}>
							<div className="flex items-center gap-2">
								{getModelIcon(modelValue)}
								{getModelLabel(modelValue)}
							</div>
						</SelectItem>
					);
				})}
			</SelectContent>
		</Select>
	);
}

export default SelectModel;
