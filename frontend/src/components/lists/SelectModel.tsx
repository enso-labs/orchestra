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
import { useState, useEffect } from "react";
import { getAuthToken } from "@/lib/utils/auth";
import { listModels } from "@/lib/services/modelService";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";

function SelectModel({ onModelSelected }: { onModelSelected?: () => void }) {
	const { model, setModel } = useModel();
	const [modelValues, setModelValues] = useState<string[]>([]);

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

	useEffect(() => {
		const fetchModels = async () => {
			const response = await listModels();
			setModelValues(response.data.models);
		};
		fetchModels();
	}, []);

	const authToken = getAuthToken?.();

	const allowedModelsIfNoAuth = [
		"anthropic:claude-haiku-4-5",
		"google_genai:gemini-2.5-flash-lite",
		"groq:openai/gpt-oss-120b",
		"openai:gpt-5-nano",
		"xai:grok-4-fast",
	];

	return (
		<Select
			value={model ?? allowedModelsIfNoAuth[0] as string}
			onValueChange={handleModelChange}
		>
			<SelectTrigger>
				<SelectValue placeholder="Select Model" />
			</SelectTrigger>
			<SelectContent>
				{modelValues.map((modelValue: string) => {
					const disabled =
						!authToken && !allowedModelsIfNoAuth.includes(modelValue as string);
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
