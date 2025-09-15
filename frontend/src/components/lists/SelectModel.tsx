import { Select } from "@/components/ui/select";
import {
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { SiAnthropic, SiOpenai, SiOllama, SiGoogle } from "react-icons/si";
import GroqIcon from "@/components/icons/GroqIcon";
import { useChatContext } from "@/context/ChatContext";

export class ChatModels {
	public static readonly OPENAI_GPT_5_NANO = "openai:gpt-5-nano";
	public static readonly OPENAI_GPT_5_MINI = "openai:gpt-5-mini";
	public static readonly OPENAI_GPT_5 = "openai:gpt-5";
	// public static readonly ANTHROPIC_CLAUDE_4_SONNET =
	// 	"anthropic:claude-sonnet-4-20250514";
	// public static readonly ANTHROPIC_CLAUDE_4_OPUS =
	// 	"anthropic:claude-opus-4-20250514";
	// public static readonly XAI_GROK_4 = "xai:grok-4-0709";
	// public static readonly GOOGLE_GEMINI_2_0_PRO = "google-vertexai:gemini-2.0-pro";
	// public static readonly GOOGLE_GEMINI_2_5_FLASH_LITE =
	// 	"google-vertexai:gemini-2.5-flash-lite-preview-06-17";
	// public static readonly GOOGLE_GEMINI_2_5_FLASH =
	// 	"google-vertexai:gemini-2.5-flash";
	// public static readonly GOOGLE_GEMINI_2_5_PRO =
	// 	"google-vertexai:gemini-2.5-pro";
	// public static readonly GROQ_DEEPSEEK_R1_DISTILL_LLAMA_70B = "groq:deepseek-r1-distill-llama-70b"; # Issues parsing route.ts (21:24)
	// public static readonly GROQ_LLAMA_3_3_70B_VERSATILE =
	// 	"groq:llama-3.3-70b-versatile";
	// public static readonly OLLAMA_QWEN3 = "ollama:qwen3";
}

function SelectModel({ onModelSelected }: { onModelSelected?: () => void }) {
	const { model, setModel } = useChatContext();

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
		if (
			modelValue.startsWith("google:") ||
			modelValue.startsWith("google-vertexai:")
		) {
			return <SiGoogle className="h-4 w-4" />;
		}
		return null;
	};

	const getModelLabel = (modelValue: string) => {
		return modelValue.split(":")[1] || modelValue;
	};

	const modelValues = Object.values(ChatModels).sort();

	return (
		<Select value={model} onValueChange={handleModelChange}>
			<SelectTrigger>
				<SelectValue placeholder="Select Model" />
			</SelectTrigger>
			<SelectContent>
				{modelValues.map((modelValue) => (
					<SelectItem key={modelValue} value={modelValue}>
						<div className="flex items-center gap-2">
							{getModelIcon(modelValue)}
							{getModelLabel(modelValue)}
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export default SelectModel;
