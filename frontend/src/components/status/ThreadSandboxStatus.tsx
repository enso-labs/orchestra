import { useEffect, useMemo, useState } from "react";
import {
	Check,
	ChevronsUpDown,
	LoaderCircle,
	SquareTerminal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
	DEFAULT_SANDBOX,
	SANDBOX_OPTIONS,
	getSandboxOption,
	normalizeSandboxValue,
	toSandboxPatchValue,
} from "@/lib/config/sandbox";
import {
	type ProviderKeyStatus,
	type SandboxType,
	getSettings,
	patchDefaults,
} from "@/lib/services/userSettingsService";
import { useSandboxHealth } from "@/hooks/useSandboxHealth";

export default function ThreadSandboxStatus() {
	const [open, setOpen] = useState(false);
	const [sandbox, setSandbox] = useState<SandboxType>(DEFAULT_SANDBOX);
	const [loading, setLoading] = useState(true);
	const [providerKeys, setProviderKeys] = useState<ProviderKeyStatus[]>([]);
	const [mcpSandboxUrl, setMcpSandboxUrl] = useState<string | null>(null);
	const currentOption = getSandboxOption(sandbox);
	const { isHealthy, refresh } = useSandboxHealth(mcpSandboxUrl);

	const visibleOptions = useMemo(
		() =>
			SANDBOX_OPTIONS.filter((opt) => {
				if (opt.value === "daytona") {
					return providerKeys.some(
						(k) => k.provider === "DAYTONA_API_KEY" && k.is_set,
					);
				}
				if (opt.value === "mcp") {
					return !!mcpSandboxUrl;
				}
				return true;
			}),
		[providerKeys, mcpSandboxUrl],
	);

	useEffect(() => {
		let isActive = true;

		getSettings()
			.then((res) => {
				if (!isActive) {
					return;
				}

				setSandbox(normalizeSandboxValue(res.defaults.sandbox));
				setProviderKeys(res.provider_keys ?? []);
				setMcpSandboxUrl(res.defaults.mcp_sandbox_url ?? null);
			})
			.catch(() => {
				if (isActive) {
					setSandbox(DEFAULT_SANDBOX);
				}
			})
			.finally(() => {
				if (isActive) {
					setLoading(false);
				}
			});

		return () => {
			isActive = false;
		};
	}, []);

	const handleSelect = async (value: SandboxType) => {
		if (value === sandbox) {
			setOpen(false);
			return;
		}

		setLoading(true);

		try {
			const res = await patchDefaults({
				sandbox: toSandboxPatchValue(value),
			});
			setSandbox(normalizeSandboxValue(res.defaults.sandbox));
			setOpen(false);
			toast.success("Sandbox updated");
		} catch {
			toast.error("Failed to update sandbox");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			className="flex items-center justify-start"
			data-tour="sandbox-selector"
		>
			<Popover
				open={open}
				onOpenChange={(isOpen) => {
					setOpen(isOpen);
					if (isOpen) refresh();
				}}
			>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 rounded-full border border-border/60 px-3 text-xs text-muted-foreground hover:text-foreground"
						aria-label={`Sandbox: ${currentOption.label}`}
						disabled={loading}
					>
						<SquareTerminal className="h-3.5 w-3.5" />
						<span>Sandbox</span>
						<span className="text-foreground">{currentOption.shortLabel}</span>
						{loading ? (
							<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
						) : (
							<ChevronsUpDown className="h-3.5 w-3.5" />
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent
					side="top"
					align="start"
					className="w-80 p-2"
					aria-label="Sandbox selection"
				>
					<div className="px-2 pb-2">
						<p className="text-sm font-medium">Execution Sandbox</p>
						<p className="text-xs text-muted-foreground">
							Choose which sandbox backend new agent actions should use.
						</p>
					</div>
					<div className="space-y-1">
						{visibleOptions.map((option) => {
							const selected = option.value === sandbox;

							return (
								<button
									key={option.value}
									type="button"
									onClick={() => handleSelect(option.value)}
									aria-label={`Select ${option.label} sandbox`}
									className={cn(
										"flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
										selected && "bg-accent",
									)}
								>
									<Check
										className={cn(
											"mt-0.5 h-4 w-4 text-primary",
											selected ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-2 text-sm font-medium">
											{option.label}
											{option.value === "mcp" && isHealthy !== null && (
												<span
													className={`h-2 w-2 rounded-full ${isHealthy ? "bg-green-500" : "bg-red-500"}`}
												/>
											)}
										</span>
										<span className="block text-xs text-muted-foreground">
											{option.description}
										</span>
									</span>
								</button>
							);
						})}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
