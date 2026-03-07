import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import {
	DEFAULT_SANDBOX,
	SANDBOX_OPTIONS,
	normalizeSandboxValue,
	toSandboxPatchValue,
} from "@/lib/config/sandbox";
import {
	type SandboxType,
	getSettings,
	patchDefaults,
} from "@/lib/services/userSettingsService";

export function SandboxSettings() {
	const [sandbox, setSandbox] = useState<SandboxType>(DEFAULT_SANDBOX);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		getSettings()
			.then((res) => setSandbox(normalizeSandboxValue(res.defaults.sandbox)))
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

	return (
		<Card>
			<CardHeader>
				<CardTitle>Default Sandbox</CardTitle>
				<CardDescription>
					Choose the sandbox backend for agent code execution. Auto will try
					Daytona first, then fall back to local.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Select value={sandbox} onValueChange={handleChange} disabled={loading}>
					<SelectTrigger className="w-full max-w-sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SANDBOX_OPTIONS.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.value === "auto"
									? `${opt.label} (Recommended)`
									: opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</CardContent>
		</Card>
	);
}
