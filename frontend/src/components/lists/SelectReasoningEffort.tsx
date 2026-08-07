import { useState } from "react";
import { Check, Brain } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { patchDefaults } from "@/lib/services/userSettingsService";
import { queryKeys } from "@/lib/queryKeys";
import type { ModelsResponse } from "@/lib/services/modelService";

/** Sentinel for "let the provider decide" — distinct from any real effort. */
export const AUTO_EFFORT = "__auto__";

interface SelectReasoningEffortProps {
	/** Model the effort will apply to. */
	model: string | null;
	/** Models payload, which carries the per-model effort values. */
	models: ModelsResponse;
	disabled?: boolean;
}

/**
 * Reasoning-effort picker for the chat input.
 *
 * Renders nothing unless the active model publishes effort values, because the
 * accepted set is model-specific (`o3` stops at `high`, `gpt-5.6-luna` goes up
 * to `max`) and sending an unsupported one is a 400 from the provider. The
 * choice is saved as a user default, mirroring how the model picker works.
 */
export function SelectReasoningEffort({
	model,
	models,
	disabled,
}: SelectReasoningEffortProps) {
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const queryClient = useQueryClient();

	const options = (model && models?.reasoning?.[model]) || [];
	const current = models?.default_reasoning_effort ?? null;

	// Model does not take an effort — no control to show.
	if (options.length === 0) return null;

	const handleSelect = async (value: string) => {
		setOpen(false);
		const effort = value === AUTO_EFFORT ? null : value;
		if (effort === current) return;
		setSaving(true);
		try {
			await patchDefaults({ reasoning_effort: effort });
			await queryClient.invalidateQueries({ queryKey: queryKeys.models() });
			await queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
			toast.success(
				effort
					? `Reasoning effort set to ${effort}`
					: "Reasoning effort cleared",
			);
		} catch {
			toast.error("Failed to update reasoning effort");
		} finally {
			setSaving(false);
		}
	};

	// An effort saved for a previous model may not exist on this one; show what
	// will actually be applied rather than a value that gets dropped server-side.
	const applied = current && options.includes(current) ? current : null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					data-testid="reasoning-effort-selector"
					disabled={disabled || saving}
					title="Change reasoning effort"
					aria-label={`Reasoning effort: ${applied ?? "auto"}`}
					className={cn(
						"inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
						"text-muted-foreground select-none cursor-pointer hover:opacity-80 transition-opacity",
						(disabled || saving) && "opacity-60 cursor-not-allowed",
					)}
				>
					<Brain className="h-3 w-3" />
					<span>{applied ?? "auto"}</span>
				</button>
			</PopoverTrigger>
			<PopoverContent side="top" align="end" className="w-[200px] p-0">
				<Command>
					<CommandList>
						<CommandGroup heading="Reasoning effort">
							<CommandItem value={AUTO_EFFORT} onSelect={handleSelect}>
								<Check
									className={cn(
										"mr-2 h-4 w-4",
										applied === null ? "opacity-100" : "opacity-0",
									)}
								/>
								auto
							</CommandItem>
							{options.map((option) => (
								<CommandItem
									key={option}
									value={option}
									onSelect={handleSelect}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											applied === option ? "opacity-100" : "opacity-0",
										)}
									/>
									{option}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export default SelectReasoningEffort;
