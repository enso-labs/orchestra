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
import { getSettings, patchDefaults } from "@/lib/services/userSettingsService";

const SANDBOX_OPTIONS = [
	{ value: "auto", label: "Auto (Recommended)" },
	{ value: "daytona", label: "Daytona" },
	{ value: "state", label: "Local" },
] as const;

export function SandboxSettings() {
	const [sandbox, setSandbox] = useState<string>("auto");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		getSettings()
			.then((res) => setSandbox(res.defaults.sandbox ?? "auto"))
			.catch(() => {});
	}, []);

	const handleChange = async (value: string) => {
		setLoading(true);
		try {
			const res = await patchDefaults({
				sandbox: value === "auto" ? null : value,
			});
			setSandbox(res.defaults.sandbox ?? "auto");
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
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</CardContent>
		</Card>
	);
}
