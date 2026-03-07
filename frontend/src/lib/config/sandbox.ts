import type { SandboxType } from "@/lib/services/userSettingsService";

export type SandboxOption = {
	value: SandboxType;
	label: string;
	shortLabel: string;
	description: string;
};

export const DEFAULT_SANDBOX: SandboxType = "auto";

export const SANDBOX_OPTIONS: readonly SandboxOption[] = [
	{
		value: "auto",
		label: "Auto",
		shortLabel: "Auto",
		description: "Try Daytona first, then fall back to local execution.",
	},
	{
		value: "daytona",
		label: "Daytona",
		shortLabel: "Daytona",
		description: "Run agent code in the Daytona sandbox backend.",
	},
	{
		value: "state",
		label: "Local",
		shortLabel: "Local",
		description: "Run agent code with the local sandbox backend.",
	},
] as const;

export function normalizeSandboxValue(
	value: string | null | undefined,
): SandboxType {
	if (value === "daytona" || value === "state") {
		return value;
	}

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

export function toSandboxPatchValue(value: SandboxType): string | null {
	return value === DEFAULT_SANDBOX ? null : value;
}
