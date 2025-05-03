import { useEffect } from "react";
import { Select } from "@/components/ui/select";
import { SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Model } from "@/services/modelService";
import { SiAnthropic, SiOpenai, SiOllama, SiGoogle } from 'react-icons/si';
import GroqIcon from "@/components/icons/GroqIcon";
import { useSearchParams } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";

function SelectModel() {
	const { payload, useSelectModelEffect, models } = useChatContext();
	const [searchParams, setSearchParams] = useSearchParams();
	const currentModel = searchParams.get('model') || '';
	const handleModelChange = (modelId: string) => {
			setSearchParams({ model: modelId });
	}

	useSelectModelEffect(currentModel);

	useEffect(() => {
			setSearchParams({ model: payload.model });
	}, [payload.model]);

	return (
		<Select value={currentModel} onValueChange={handleModelChange}>
			<SelectTrigger className="w-[200px]">
					<SelectValue placeholder="Select Model" />
			</SelectTrigger>
			<SelectContent>
					{models
							.sort((a: Model, b: Model) => a.id.localeCompare(b.id))
							.filter((model: Model) => !model.metadata.embedding)
							.map((model: Model) => (
							<SelectItem key={model.id} value={model.id}>
									<div className="flex items-center gap-2">
									{model.provider === 'openai' && (
											<SiOpenai className="h-4 w-4" />
									)}
									{model.provider === 'anthropic' && (
											<SiAnthropic className="h-4 w-4" />
									)}
									{model.provider === 'ollama' && (
											<SiOllama className="h-4 w-4" />
									)}
									{model.provider === 'groq' && (
											<GroqIcon />
									)}
									{model.provider === 'google' && (
											<SiGoogle className="h-4 w-4" />
									)}
									{model.label}
									</div>
							</SelectItem>
					))}
			</SelectContent>
		</Select>
	);
}

export default SelectModel;