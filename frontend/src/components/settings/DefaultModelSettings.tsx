import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { toast } from "sonner";
import { useChatContext } from "@/context/ChatContext";
import { useModelVisibility } from "@/hooks/useModelVisibility";
import {
	getSettings,
	updateDefaultModel,
} from "@/lib/services/userSettingsService";

export function DefaultModelSettings() {
	const { models, useModelsEffect } = useChatContext();
	const { isModelVisible } = useModelVisibility();
	const [open, setOpen] = useState(false);
	const [defaultModel, setDefaultModel] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useModelsEffect?.();

	useEffect(() => {
		getSettings()
			.then((res) => setDefaultModel(res.default_model))
			.catch(() => {});
	}, []);

	const allModels: string[] = models?.models || [];
	const visibleModels = allModels.filter((m) => isModelVisible(m));

	const getModelLabel = (modelValue: string) =>
		modelValue.split(":")[1] || modelValue;

	const handleSelect = async (model: string) => {
		setOpen(false);
		setLoading(true);
		try {
			const res = await updateDefaultModel(model);
			setDefaultModel(res.default_model);
			toast.success("Default model updated");
		} catch {
			toast.error("Failed to update default model");
		} finally {
			setLoading(false);
		}
	};

	const handleClear = async () => {
		setLoading(true);
		try {
			const res = await updateDefaultModel(null);
			setDefaultModel(res.default_model);
			toast.success("Default model cleared");
		} catch {
			toast.error("Failed to clear default model");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Default Model</CardTitle>
				<CardDescription>
					Choose a default AI model for new conversations. When not set, the
					system default is used.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-2">
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								role="combobox"
								aria-expanded={open}
								disabled={loading}
								className="w-full max-w-sm justify-between"
							>
								<span className="truncate">
									{defaultModel
										? getModelLabel(defaultModel)
										: "System default"}
								</span>
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Search models..." />
								<CommandList>
									<CommandEmpty>No model found.</CommandEmpty>
									<CommandGroup>
										{visibleModels.map((modelValue) => (
											<CommandItem
												key={modelValue}
												value={modelValue}
												onSelect={handleSelect}
											>
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														defaultModel === modelValue
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												{getModelLabel(modelValue)}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					{defaultModel && (
						<Button
							variant="ghost"
							size="icon"
							disabled={loading}
							onClick={handleClear}
							title="Clear default model"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
