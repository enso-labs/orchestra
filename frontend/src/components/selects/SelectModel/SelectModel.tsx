import { useEffect } from "react";
import { Select } from "@/components/ui/select";
import { SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Model } from "@/lib/services/modelService";
import { SiAnthropic, SiOpenai, SiOllama, SiGoogle } from 'react-icons/si';
import GroqIcon from "@/components/icons/GroqIcon";
import { useQueryParam, StringParam, withDefault } from 'use-query-params';
import { useChatContext } from "@/context/ChatContext";
import { useModel } from "@/hooks/useModel";



function SelectModel() {
	// Create a parameter with default value
	const { setPayload, models } = useChatContext();
	const [model, setModel] = useQueryParam('model', withDefault(StringParam, useModel()));

	const handleModelChange = (modelId: string) => {
		setModel(modelId);
	}

	// Update payload.model when URL param changes
	useEffect(() => {
		if (model) {
			setPayload((prev: any) => ({ ...prev, model }));
		}
	}, [model]);

	return (
		<Select value={model} onValueChange={handleModelChange}>
			<SelectTrigger>
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