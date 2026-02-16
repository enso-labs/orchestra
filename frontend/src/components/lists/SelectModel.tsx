import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { SiAnthropic, SiOpenai, SiOllama, SiGoogle } from "react-icons/si";
import { FaAws } from "react-icons/fa";
import GroqIcon from "@/components/icons/GroqIcon";
import XAIIcon from "../icons/XAIIcon";
import { getAuthToken } from "@/lib/utils/auth";
import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { truncateFrom } from "@/lib/utils/format";
import { useChatContext } from "@/context/ChatContext";
import { useModelVisibility } from "@/hooks/useModelVisibility";
import type { ModelsResponse } from "@/lib/services/modelService";

interface SelectModelProps {
	onModelSelected?: () => void;
	disabled?: boolean;
	/** Controlled value — when provided, SelectModel uses this instead of ChatContext's model. */
	value?: string;
	/** Called with the new model string when the user picks a model. */
	onChange?: (model: string) => void;
	/** Models list — when provided, SelectModel uses this instead of ChatContext's models. */
	modelsList?: ModelsResponse;
}

function SelectModel({
	onModelSelected,
	disabled,
	value,
	onChange,
	modelsList,
}: SelectModelProps) {
	// Always call hooks (React rules), but only use their values as fallback
	const ctx = useChatContext();
	const { isModelVisible } = useModelVisibility();
	const [open, setOpen] = useState(false);

	const isControlled = value !== undefined;
	const currentModel: string | null = isControlled ? value : ctx.model;
	const models: ModelsResponse = modelsList ?? ctx.models;

	const handleModelChange = (newValue: string) => {
		if (onChange) {
			onChange(newValue);
		} else {
			ctx.setModel(newValue);
		}
		setOpen(false);
		onModelSelected?.(value);
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
		if (modelValue.startsWith("bedrock_converse:")) {
			return <FaAws className="h-4 w-4" />;
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
	const currentValue = currentModel ?? models.default;
	const currentLabel = currentValue ? getModelLabel(currentValue) : "";

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					disabled={disabled}
					aria-expanded={open}
					className={cn(
						"w-full justify-between",
						disabled && "opacity-60 bg-muted/50 cursor-not-allowed",
					)}
				>
					<span className="flex items-center gap-2 truncate">
						{currentValue && getModelIcon(currentValue)}
						{currentValue ? getTruncatedLabel(currentLabel) : "Select model..."}
					</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[--radix-popover-trigger-width] p-0">
				<Command>
					<CommandInput placeholder="Search models..." />
					<CommandList className="max-h-[300px] overflow-y-auto">
						<CommandEmpty>No model found.</CommandEmpty>
						<CommandGroup>
							{models.models
								.filter((m: string) => isModelVisible(m))
								.map((modelValue: string) => {
									const disabled =
										!authToken && !models.free.includes(modelValue as string);
									const fullLabel = getModelLabel(modelValue);
									const truncatedLabel = getTruncatedLabel(fullLabel);
									const needsTooltip = fullLabel.length > 20;

									const itemContent = (
										<CommandItem
											key={modelValue}
											value={modelValue}
											onSelect={handleModelChange}
											disabled={disabled}
											className="flex items-center gap-2"
										>
											<Check
												className={cn(
													"h-4 w-4",
													currentValue === modelValue
														? "opacity-100"
														: "opacity-0",
												)}
											/>
											{getModelIcon(modelValue)}
											<span className="truncate">{truncatedLabel}</span>
										</CommandItem>
									);

									return needsTooltip ? (
										<MainToolTip
											key={modelValue}
											content={fullLabel}
											delayDuration={300}
										>
											{itemContent}
										</MainToolTip>
									) : (
										itemContent
									);
								})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export default SelectModel;
