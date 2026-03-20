import type { SandboxType } from "@/lib/services/userSettingsService";

export type SandboxOption = {
	value: SandboxType;
	label: string;
	shortLabel: string;
	description: string;
};

export const DEFAULT_SANDBOX: SandboxType = "state";

export const SANDBOX_OPTIONS: readonly SandboxOption[] = [
	{
		value: "state",
		label: "State (Default)",
		shortLabel: "State",
		description: "Run agent code with the state sandbox backend.",
	},
	{
		value: "daytona",
		label: "Daytona",
		shortLabel: "Daytona",
		description: "Run agent code in the Daytona sandbox backend.",
	},
	{
		value: "mcp",
		label: "MCP Sandbox",
		shortLabel: "MCP",
		description: "Run agent code in an isolated MCP sandbox container.",
	},
] as const;

export function normalizeSandboxValue(
	value: string | null | undefined,
): SandboxType {
	if (value === "daytona" || value === "mcp") {
		return value;
	}

	// "auto", null, undefined, and any unknown value all resolve to "state"
	return DEFAULT_SANDBOX;
}

export function getSandboxOption(
	value: string | null | undefined,
): SandboxOption {
	return (
		SANDBOX_OPTIONS.find(
			(option) => option.value === normalizeSandboxValue(value),
		) ?? SANDBOX_OPTIONS[0]
	);
}

export function toSandboxPatchValue(value: SandboxType): string {
	return value;
}
