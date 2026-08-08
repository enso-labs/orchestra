import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
	SANDBOX_OPTIONS,
	normalizeSandboxValue,
	toSandboxPatchValue,
} from "@/lib/config/sandbox";
import {
	type ProviderKeyStatus,
	type SandboxType,
	getSettings,
	patchDefaults,
	upsertProviderKey,
	deleteProviderKey,
} from "@/lib/services/userSettingsService";
import { useSandboxHealth } from "@/hooks/useSandboxHealth";
import { queryKeys } from "@/lib/queryKeys";

export function SandboxSettings() {
	const [loading, setLoading] = useState(false);
	const queryClient = useQueryClient();

	// MCP config local state (user edits before saving)
	const [mcpUrl, setMcpUrl] = useState("");
	const [mcpApiKey, setMcpApiKey] = useState("");
	const mcpUrlInitializedRef = useRef(false);
	const [saving, setSaving] = useState(false);

	const { data: settingsData } = useQuery({
		queryKey: queryKeys.settings(),
		queryFn: getSettings,
	});

	// Derive state from query data
	const sandbox: SandboxType = normalizeSandboxValue(
		settingsData?.defaults.sandbox ?? null,
	);
	const providerKeys: ProviderKeyStatus[] = settingsData?.provider_keys ?? [];
	const savedMcpUrl = settingsData?.defaults.mcp_sandbox_url ?? null;
	const mcpApiKeyIsSet = providerKeys.some(
		(k) => k.provider === "MCP_SANDBOX_API_KEY" && k.is_set,
	);

	// Initialize local mcpUrl from server data (once, via effect)
	useEffect(() => {
		if (settingsData && !mcpUrlInitializedRef.current) {
			setMcpUrl(settingsData.defaults.mcp_sandbox_url ?? "");
			mcpUrlInitializedRef.current = true;
		}
	}, [settingsData]);

	const {
		isHealthy,
		isLoading: healthLoading,
		refresh,
	} = useSandboxHealth(savedMcpUrl || null);

	const visibleOptions = useMemo(
		() =>
			SANDBOX_OPTIONS.filter((opt) => {
				if (opt.value === "daytona") {
					return providerKeys.some(
						(k) => k.provider === "DAYTONA_API_KEY" && k.is_set,
					);
				}
				return true;
			}),
		[providerKeys],
	);

	const invalidateSettings = () =>
		queryClient.invalidateQueries({ queryKey: queryKeys.settings() });

	const handleChange = async (value: string) => {
		const nextSandbox = normalizeSandboxValue(value);
		setLoading(true);
		try {
			await patchDefaults({
				sandbox: toSandboxPatchValue(nextSandbox),
			});
			invalidateSettings();
			toast.success("Default sandbox updated");
		} catch {
			toast.error("Failed to update default sandbox");
		} finally {
			setLoading(false);
		}
	};

	const handleMcpSave = async () => {
		const url = mcpUrl.trim() || null;
		setSaving(true);
		try {
			// Save URL
			await patchDefaults({ mcp_sandbox_url: url });

			// Save or clear API key
			if (mcpApiKey.trim()) {
				await upsertProviderKey("MCP_SANDBOX_API_KEY", mcpApiKey.trim());
				setMcpApiKey("");
			}

			toast.success("MCP sandbox configuration saved");

			// If URL was cleared while MCP is selected, revert to state
			if (!url && sandbox === "mcp") {
				await patchDefaults({ sandbox: "state" });
			}

			invalidateSettings();

			// Trigger health check after save
			if (url) {
				setTimeout(() => refresh(), 500);
			}
		} catch {
			toast.error("Failed to save MCP sandbox configuration");
		} finally {
			setSaving(false);
		}
	};

	const handleClearApiKey = async () => {
		try {
			await deleteProviderKey("MCP_SANDBOX_API_KEY");
			invalidateSettings();
			toast.success("MCP API key removed");
		} catch {
			toast.error("Failed to remove MCP API key");
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Default Sandbox</CardTitle>
				<CardDescription>
					Choose the sandbox backend for agent code execution.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<Select
					value={sandbox}
					onValueChange={handleChange}
					disabled={loading}
					onOpenChange={(open) => {
						if (open) refresh();
					}}
				>
					<SelectTrigger className="w-full max-w-sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{visibleOptions.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								<span className="flex items-center gap-2">
									{opt.label}
									{opt.value === "mcp" && savedMcpUrl && isHealthy !== null && (
										<span
											className={`h-2 w-2 rounded-full ${isHealthy ? "bg-green-500" : "bg-red-500"}`}
										/>
									)}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{sandbox === "mcp" && (
					<div className="rounded-lg border border-border p-4 space-y-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">MCP Sandbox Configuration</p>
							<p className="text-xs text-muted-foreground">
								Configure the URL and optional API key for your MCP sandbox
								server.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="mcp-sandbox-url">Server URL</Label>
							<Input
								id="mcp-sandbox-url"
								type="text"
								placeholder="http://localhost:3005/mcp"
								value={mcpUrl}
								onChange={(e) => setMcpUrl(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleMcpSave();
								}}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="mcp-sandbox-api-key">
								API Key{" "}
								<span className="text-muted-foreground font-normal">
									(optional)
								</span>
							</Label>
							<Input
								id="mcp-sandbox-api-key"
								type="password"
								placeholder={
									mcpApiKeyIsSet
										? "Key configured - enter new value to update"
										: "Enter API key if server requires authentication"
								}
								value={mcpApiKey}
								onChange={(e) => setMcpApiKey(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleMcpSave();
								}}
							/>
							{mcpApiKeyIsSet && (
								<div className="flex items-center gap-2">
									<span className="text-xs text-muted-foreground">
										API key is configured
									</span>
									<button
										type="button"
										onClick={handleClearApiKey}
										className="text-xs text-destructive-accent hover:underline"
									>
										Remove
									</button>
								</div>
							)}
						</div>

						<div className="flex items-center gap-3">
							<Button
								onClick={handleMcpSave}
								disabled={saving || !mcpUrl.trim()}
								size="sm"
							>
								{saving ? (
									<>
										<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
										Saving...
									</>
								) : (
									"Save"
								)}
							</Button>

							{savedMcpUrl && (
								<div className="flex items-center gap-1.5 text-xs">
									{healthLoading ? (
										<>
											<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
											<span className="text-muted-foreground">Checking...</span>
										</>
									) : isHealthy === true ? (
										<>
											<CheckCircle className="h-3.5 w-3.5 text-green-500" />
											<span className="text-green-500">Connected</span>
										</>
									) : isHealthy === false ? (
										<>
											<XCircle className="h-3.5 w-3.5 text-red-500" />
											<span className="text-red-500">Unreachable</span>
										</>
									) : null}
									<button
										type="button"
										onClick={refresh}
										className="text-xs text-muted-foreground hover:underline ml-1"
									>
										Refresh
									</button>
								</div>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
