import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { getSettings, patchDefaults } from "@/lib/services/userSettingsService";
import { queryKeys } from "@/lib/queryKeys";

const TIMEZONES = Intl.supportedValuesOf("timeZone");
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function TimezoneSettings() {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const queryClient = useQueryClient();

	const { data: settings } = useQuery({
		queryKey: queryKeys.settings(),
		queryFn: getSettings,
	});
	const timezone = settings?.defaults.timezone ?? null;

	const patchMutation = useMutation({
		mutationFn: (timezone: string | null) => patchDefaults({ timezone }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
		},
	});

	const handleSelect = async (tz: string) => {
		setOpen(false);
		setLoading(true);
		try {
			await patchMutation.mutateAsync(tz);
			toast.success("Timezone updated");
		} catch {
			toast.error("Failed to update timezone");
		} finally {
			setLoading(false);
		}
	};

	const handleClear = async () => {
		setLoading(true);
		try {
			await patchMutation.mutateAsync(null);
			toast.success("Timezone reset to auto-detect");
		} catch {
			toast.error("Failed to clear timezone");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Timezone</CardTitle>
				<CardDescription>
					Choose your preferred timezone for AI responses. When not set, your
					browser timezone is used ({BROWSER_TIMEZONE}).
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
									{timezone || `Auto-detect (${BROWSER_TIMEZONE})`}
								</span>
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Search timezones..." />
								<CommandList>
									<CommandEmpty>No timezone found.</CommandEmpty>
									<CommandGroup>
										{TIMEZONES.map((tz) => (
											<CommandItem key={tz} value={tz} onSelect={handleSelect}>
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														timezone === tz ? "opacity-100" : "opacity-0",
													)}
												/>
												{tz.replace(/_/g, " ")}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					{timezone && (
						<Button
							variant="ghost"
							size="icon"
							disabled={loading}
							onClick={handleClear}
							title="Reset to auto-detect"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
