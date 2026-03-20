import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import {
	DEFAULT_SANDBOX,
	SANDBOX_OPTIONS,
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

export function SandboxSettings() {
	const [sandbox, setSandbox] = useState<SandboxType>(DEFAULT_SANDBOX);
	const [loading, setLoading] = useState(false);
	const [providerKeys, setProviderKeys] = useState<ProviderKeyStatus[]>([]);
	const [mcpSandboxUrl, setMcpSandboxUrl] = useState<string>("");
	const { isHealthy, refresh } = useSandboxHealth(mcpSandboxUrl || null);

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
		getSettings()
			.then((res) => {
				setSandbox(normalizeSandboxValue(res.defaults.sandbox));
				setProviderKeys(res.provider_keys ?? []);
				setMcpSandboxUrl(res.defaults.mcp_sandbox_url ?? "");
			})
			.catch(() => {});
	}, []);

	const handleChange = async (value: string) => {
		const nextSandbox = normalizeSandboxValue(value);
		setLoading(true);
		try {
			const res = await patchDefaults({
				sandbox: toSandboxPatchValue(nextSandbox),
			});
			setSandbox(normalizeSandboxValue(res.defaults.sandbox));
			toast.success("Default sandbox updated");
		} catch {
			toast.error("Failed to update default sandbox");
		} finally {
			setLoading(false);
		}
	};

	const handleMcpUrlSave = async () => {
		const url = mcpSandboxUrl.trim() || null;
		try {
			await patchDefaults({ mcp_sandbox_url: url });
			toast.success(url ? "MCP sandbox URL saved" : "MCP sandbox URL cleared");
			// If MCP was selected but URL is now cleared, revert to state
			if (!url && sandbox === "mcp") {
				const res = await patchDefaults({ sandbox: "state" });
				setSandbox(normalizeSandboxValue(res.defaults.sandbox));
			}
		} catch {
			toast.error("Failed to save MCP sandbox URL");
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
									{opt.value === "mcp" && isHealthy !== null && (
										<span
											className={`h-2 w-2 rounded-full ${isHealthy ? "bg-green-500" : "bg-red-500"}`}
										/>
									)}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="space-y-2">
					<Label htmlFor="mcp-sandbox-url">MCP Sandbox URL</Label>
					<Input
						id="mcp-sandbox-url"
						type="text"
						placeholder="http://localhost:3005/mcp"
						value={mcpSandboxUrl}
						onChange={(e) => setMcpSandboxUrl(e.target.value)}
						onBlur={handleMcpUrlSave}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleMcpUrlSave();
						}}
						className="max-w-sm"
					/>
				</div>
			</CardContent>
		</Card>
	);
}
