import { useState, useEffect } from "react";

const STORAGE_KEY = "orchestra_model_visibility";

const DEFAULT_ENABLED_MODELS = [
  "anthropic:claude-haiku-4-5",
  "anthropic:claude-opus-4-5",
  "anthropic:claude-sonnet-4-5",
  "google_genai:gemini-3-flash-lite-latest",
  "google_genai:gemini-3-flash-preview",
  "google_genai:gemini-3-pro-preview",
  "google_genai:gemini-flash-latest",
  "groq:deepseek-r1-distill-llama-70b",
  "groq:openai/gpt-oss-120b",
  "groq:qwen/qwen3-32b",
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

type ModelVisibilitySettings = {
  enabledModels: string[];
};

function isSettingsObject(value: unknown): value is ModelVisibilitySettings {
  return (
    typeof value === "object" &&
    value !== null &&
    "enabledModels" in value &&
    Array.isArray((value as { enabledModels?: unknown }).enabledModels)
  );
}

export function useModelVisibility() {
  const [enabledModels, setEnabledModels] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [...DEFAULT_ENABLED_MODELS];
      const parsed = JSON.parse(saved) as unknown;

      // Back-compat: if we previously stored an array, treat it as "hidden models"
      // under the old format and fall back to the new defaults.
      if (Array.isArray(parsed)) {
        return [...DEFAULT_ENABLED_MODELS];
      }

      if (isSettingsObject(parsed)) {
        return parsed.enabledModels;
      }

      return [...DEFAULT_ENABLED_MODELS];
    } catch (e) {
      console.error("Failed to parse hidden models", e);
      return [...DEFAULT_ENABLED_MODELS];
    }
  });

  useEffect(() => {
    try {
      const payload: ModelVisibilitySettings = { enabledModels };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to save hidden models", e);
    }
  }, [enabledModels]);

  const toggleModelVisibility = (modelId: string) => {
    setEnabledModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  const isModelVisible = (modelId: string) => enabledModels.includes(modelId);

  return {
    enabledModels,
    toggleModelVisibility,
    isModelVisible,
  };
}

