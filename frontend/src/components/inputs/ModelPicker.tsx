import { useEffect, useState } from "react";
import { Check, LoaderCircle, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelBadge, getModelLabel } from "@/components/badges/ModelBadge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useModelVisibility } from "@/hooks/useModelVisibility";
import { patchDefaults } from "@/lib/services/userSettingsService";
import { getAuthToken } from "@/lib/utils/auth";
import type { ModelsResponse } from "@/lib/services/modelService";

/**
 * Shared chip geometry. Every state renders at the same height so the action
 * row does not reflow as the query moves between loading, error, and ready.
 * `min-h-6` (24px) clears the WCAG 2.5.8 target size, which the previous
 * ~22px chip did not with `gap-2` neighbours.
 */
const CHIP =
	"inline-flex items-center gap-1.5 min-h-6 rounded-md border px-2 py-0.5 text-xs font-medium select-none";

interface ModelPickerProps {
	displayModel: string | null;
	models: ModelsResponse;
	setModel: (model: string) => void;
	isLoading: boolean;
	isError: boolean;
	isFetching: boolean;
	refetch: () => void;
}

/**
 * The chat composer's model control.
 *
 * Before this existed, the composer gated the whole picker behind
 * `{displayModel && ...}`, so an unreachable backend, an account with no
 * models, and a still-in-flight request all rendered as the same thing:
 * nothing at all. Each state now has its own honest rendering.
 */
export function ModelPicker({
	displayModel,
	models,
	setModel,
	isLoading,
	isError,
	isFetching,
	refetch,
}: ModelPickerProps) {
	const [modelOpen, setModelOpen] = useState(false);
	const { isModelVisible } = useModelVisibility();

	const allModels = models?.models || [];
	const visibleModels = allModels.filter((m: string) => isModelVisible(m));
	const allHidden = allModels.length > 0 && visibleModels.length === 0;

	// If the popover is open when the query fails, its content is about to be
	// unmounted. Close it deliberately so focus returns to the composer rather
	// than being dropped on <body>.
	useEffect(() => {
		if (isError) setModelOpen(false);
	}, [isError]);

	const handleModelSelect = async (model: string) => {
		setModelOpen(false);
		try {
			await patchDefaults({ model });
			setModel(model);
			toast.success("Default model updated");
		} catch {
			toast.error("Failed to update model");
		}
	};

	// The query is disabled without a token, so it reports neither loading nor
	// error. Render nothing at all — the login screen must not advertise an
	// empty model list.
	if (!getAuthToken()) return null;

	// One polite live region for the whole control, rendering "" rather than
	// unmounting when healthy: an unmounted region announces nothing on the
	// transition into it.
	const liveMessage = isError
		? "Model list unavailable. The server could not be reached."
		: !isLoading && allModels.length === 0
			? "No models available."
			: "";

	const announcer = (
		<span
			role="status"
			aria-live="polite"
			aria-atomic="true"
			className="sr-only"
		>
			{liveMessage}
		</span>
	);

	if (isLoading) {
		return (
			<>
				{announcer}
				<Skeleton
					data-testid="model-picker-skeleton"
					className="h-6 w-24 rounded-md"
					aria-hidden="true"
				/>
			</>
		);
	}

	if (isError) {
		// Enabled and focusable on purpose. A disabled chip communicates "not
		// for you" rather than "not right now", and offers no way back.
		return (
			<>
				{announcer}
				<button
					type="button"
					data-testid="model-picker-error"
					onClick={() => refetch()}
					disabled={isFetching}
					title="Models could not be loaded. Click to retry."
					aria-label={
						isFetching
							? "Retrying to load models"
							: "Models unavailable. Retry loading models."
					}
					className={cn(
						CHIP,
						// The destructive tint is the shipped run-error triple from
						// lists/ChatMessages.tsx, but its `text-destructive` was measured
						// at 1.93:1 (dark), 3.30:1 (light) and 1.08:1 (gray) here — the
						// palette's --destructive is a dark red meant to sit *behind*
						// destructive-foreground, not to be read as text. `text-foreground`
						// measures 18.5 / 17.5 / 6.1, so the label stays legible and the
						// WifiOff icon carries the meaning without relying on color.
						"border-destructive/40 bg-destructive/10 text-foreground",
						"cursor-pointer hover:opacity-80 transition-opacity",
						isFetching && "opacity-60 cursor-not-allowed",
					)}
				>
					{isFetching ? (
						<LoaderCircle className="h-3 w-3 animate-spin" />
					) : (
						<WifiOff className="h-3 w-3" />
					)}
					<span>{isFetching ? "Retrying…" : "Models unavailable"}</span>
				</button>
			</>
		);
	}

	// A successful fetch that returned nothing is not a failure — never show
	// the error chip here. Copy matches settings/ModelVisibilitySettings.
	if (allModels.length === 0) {
		return (
			<>
				{announcer}
				<span
					data-testid="model-picker-empty"
					title="No models are configured for this account."
					className={cn(CHIP, "text-muted-foreground")}
				>
					No models available
				</span>
			</>
		);
	}

	return (
		<>
			{announcer}
			<Popover open={modelOpen} onOpenChange={setModelOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						data-tour="model-selector"
						data-testid="model-picker-trigger"
						title="Change default model"
						aria-label={`Model: ${displayModel ? getModelLabel(displayModel) : "none selected"}`}
						className="inline-flex items-center min-h-6 cursor-pointer hover:opacity-80 transition-opacity"
					>
						{displayModel ? (
							<ModelBadge model={displayModel} />
						) : (
							// Loaded fine, but the account has no default set. Previously
							// this also rendered nothing.
							<span className={cn(CHIP, "text-muted-foreground")}>
								Select model
							</span>
						)}
					</button>
				</PopoverTrigger>
				<PopoverContent side="top" align="end" className="w-[280px] p-0">
					<Command>
						<CommandInput placeholder="Search models..." />
						<CommandList>
							<CommandEmpty>
								{allHidden
									? "All models are hidden. Turn some on in Settings → Model Visibility."
									: "No model found."}
							</CommandEmpty>
							<CommandGroup>
								{visibleModels.map((modelValue: string) => (
									<CommandItem
										key={modelValue}
										value={modelValue}
										onSelect={handleModelSelect}
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												displayModel === modelValue
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
		</>
	);
}

export default ModelPicker;
