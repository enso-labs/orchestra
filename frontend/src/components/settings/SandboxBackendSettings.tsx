import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
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
import {
	getSettings,
	updateSandboxBackend,
	type SandboxBackend,
} from "@/lib/services/userSettingsService";

const BACKEND_OPTIONS: Array<{ value: SandboxBackend; label: string }> = [
	{ value: "daytona", label: "Daytona" },
];

export function SandboxBackendSettings() {
	const [open, setOpen] = useState(false);
	const [sandboxBackend, setSandboxBackend] = useState<SandboxBackend | null>(
		null,
	);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		getSettings()
			.then((res) => setSandboxBackend(res.sandbox_backend))
			.catch(() => {});
	}, []);

	const handleSelect = async (backend: SandboxBackend) => {
		setOpen(false);
		setLoading(true);
		try {
			const res = await updateSandboxBackend(backend);
			setSandboxBackend(res.sandbox_backend);
			toast.success("Sandbox backend updated");
		} catch {
			toast.error("Failed to update sandbox backend");
		} finally {
			setLoading(false);
		}
	};

	const handleClear = async () => {
		setLoading(true);
		try {
			const res = await updateSandboxBackend(null);
			setSandboxBackend(res.sandbox_backend);
			toast.success("Sandbox backend reset to default");
		} catch {
			toast.error("Failed to reset sandbox backend");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Sandbox Backend</CardTitle>
				<CardDescription>
					Choose which backend runs sandboxed deep-agent tasks. Leave unset to
					use the system default behavior.
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
									{sandboxBackend
										? BACKEND_OPTIONS.find(
												(option) => option.value === sandboxBackend,
										  )?.label ?? sandboxBackend
										: "System default"}
								</span>
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Search backends..." />
								<CommandList>
									<CommandEmpty>No backend found.</CommandEmpty>
									<CommandGroup>
										{BACKEND_OPTIONS.map((option) => (
											<CommandItem
												key={option.value}
												value={option.value}
												onSelect={() => handleSelect(option.value)}
											>
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														sandboxBackend === option.value
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												{option.label}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					{sandboxBackend && (
						<Button
							variant="ghost"
							size="icon"
							disabled={loading}
							onClick={handleClear}
							title="Clear sandbox backend preference"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
