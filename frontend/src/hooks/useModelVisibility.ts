import { useState, useEffect, useCallback } from "react";
import { getSettings, patchDefaults } from "@/lib/services/userSettingsService";

const LOCALSTORAGE_KEY = "orchestra_model_visibility";

const DEFAULT_ENABLED_MODELS = [
	"anthropic:claude-haiku-4-5",
	"anthropic:claude-opus-4-6",
	"anthropic:claude-sonnet-4-6",
	"google_genai:gemini-3.1-flash-lite-preview",
	"google_genai:gemini-3.1-pro-preview",
	"google_genai:gemini-flash-latest",
	"groq:openai/gpt-oss-120b",
	"openai:gpt-4.1",
	"openai:gpt-4.1-mini",
	"openai:gpt-4.1-nano",
	"openai:gpt-4o",
	"openai:gpt-5",
	"openai:gpt-5-mini",
	"openai:gpt-5-nano",
	"openai:gpt-5.4",
	"openai:gpt-5.4-pro",
	"xai:grok-4",
	"xai:grok-4-1-fast",
	"xai:grok-4-fast",
] as const;

export function useModelVisibility() {
	const [enabledModels, setEnabledModels] = useState<string[]>([
		...DEFAULT_ENABLED_MODELS,
	]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);
		getSettings()
			.then((res) => {
				if (cancelled) return;
				const backendModels = res.defaults.model_visibility;
				if (backendModels !== null && backendModels !== undefined) {
					// Backend has data — use it (takes precedence over localStorage)
					setEnabledModels(backendModels);
					return;
				}
				// Backend is null — check localStorage for migration
				try {
					const stored = localStorage.getItem(LOCALSTORAGE_KEY);
					if (stored) {
						const parsed: string[] = JSON.parse(stored);
						if (Array.isArray(parsed) && parsed.length > 0) {
							setEnabledModels(parsed);
							patchDefaults({ model_visibility: parsed })
								.then(() => {
									localStorage.removeItem(LOCALSTORAGE_KEY);
								})
								.catch(() => {
									// Migration failed — keep localStorage for next attempt
								});
							return;
						}
					}
				} catch {
					// Invalid localStorage data — ignore
				}
				// No backend data and no localStorage — keep DEFAULT_ENABLED_MODELS
			})
			.catch(() => {
				if (!cancelled) setError("Failed to load model visibility settings");
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
		error,
	};
}
