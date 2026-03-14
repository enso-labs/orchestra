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
import { getSettings, patchDefaults } from "@/lib/services/userSettingsService";

const TIMEZONES = Intl.supportedValuesOf("timeZone");
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function TimezoneSettings() {
	const [open, setOpen] = useState(false);
	const [timezone, setTimezone] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		getSettings()
			.then((res) => setTimezone(res.defaults.timezone))
			.catch(() => {});
	}, []);

	const handleSelect = async (tz: string) => {
		setOpen(false);
		setLoading(true);
		try {
			const res = await patchDefaults({ timezone: tz });
			setTimezone(res.defaults.timezone);
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
			const res = await patchDefaults({ timezone: null });
			setTimezone(res.defaults.timezone);
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
