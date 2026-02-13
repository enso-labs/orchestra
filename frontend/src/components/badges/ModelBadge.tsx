import { SiAnthropic, SiOpenai, SiOllama, SiGoogle } from "react-icons/si";
import { FaAws } from "react-icons/fa";
import GroqIcon from "@/components/icons/GroqIcon";
import XAIIcon from "@/components/icons/XAIIcon";
import { cn } from "@/lib/utils";

interface ModelBadgeProps {
	model: string;
	className?: string;
}

export function getModelIcon(model: string) {
	if (model.startsWith("openai:")) return <SiOpenai className="h-3 w-3" />;
	if (model.startsWith("anthropic:"))
		return <SiAnthropic className="h-3 w-3" />;
	if (model.startsWith("ollama:")) return <SiOllama className="h-3 w-3" />;
	if (model.startsWith("groq:")) return <GroqIcon />;
	if (model.startsWith("xai:")) return <XAIIcon />;
	if (
		model.startsWith("google:") ||
		model.startsWith("google_genai:") ||
		model.startsWith("google-vertexai:")
	)
		return <SiGoogle className="h-3 w-3" />;
	if (model.startsWith("bedrock_converse:"))
		return <FaAws className="h-3 w-3" />;
	return null;
}

export function getModelLabel(model: string): string {
	return model.split(":")[1] || model;
}

export function ModelBadge({ model, className }: ModelBadgeProps) {
	const icon = getModelIcon(model);
	const label = getModelLabel(model);

	return (
		<span
			data-testid="model-badge"
			className={cn(
				"inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground select-none",
				className,
			)}
		>
			{icon}
			<span className="truncate max-w-[150px]">{label}</span>
		</span>
	);
}

export default ModelBadge;
