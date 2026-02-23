import { useState, useEffect, useCallback } from "react";
import { getSettings, patchDefaults } from "@/lib/services/userSettingsService";

const DEFAULT_ENABLED_MODELS = [
	"anthropic:claude-haiku-4-5",
	"anthropic:claude-opus-4-5",
	"anthropic:claude-sonnet-4-5",
	"google_genai:gemini-3-flash-lite-latest",
	"google_genai:gemini-3-flash-preview",
	"google_genai:gemini-3-pro-preview",
	"google_genai:gemini-flash-latest",
	"groq:openai/gpt-oss-120b",
	// "groq:qwen/qwen3-32b",
	"openai:gpt-4.1",
	"openai:gpt-4.1-mini",
	"openai:gpt-4.1-nano",
	"openai:gpt-4o",
	"openai:gpt-5",
	"openai:gpt-5-mini",
	"openai:gpt-5-nano",
	"openai:gpt-5.1",
	"openai:gpt-5.2",
	"openai:gpt-5.2-chat-latest",
	"openai:gpt-5.2-pro",
	"xai:grok-4",
	"xai:grok-4-1-fast",
	"xai:grok-4-fast",
] as const;

export function useModelVisibility() {
	const [enabledModels, setEnabledModels] = useState<string[]>([
		...DEFAULT_ENABLED_MODELS,
	]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		getSettings()
			.then((res) => {
				if (cancelled) return;
				const backendModels = res.defaults.model_visibility;
				if (backendModels !== null && backendModels !== undefined) {
					setEnabledModels(backendModels);
				}
				// If null, keep the DEFAULT_ENABLED_MODELS already set
			})
			.catch(() => {
				// On error, keep defaults
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const toggleModelVisibility = useCallback((modelId: string) => {
		setEnabledModels((prev: string[]) => {
			const next = prev.includes(modelId)
				? prev.filter((id: string) => id !== modelId)
				: [...prev, modelId];
			patchDefaults({ model_visibility: next }).catch(() => {
				setEnabledModels(prev);
			});
			return next;
		});
	}, []);

	const isModelVisible = useCallback(
		(modelId: string) => enabledModels.includes(modelId),
		[enabledModels],
	);

	return {
		enabledModels,
		toggleModelVisibility,
		isModelVisible,
		isLoading,
	};
}
