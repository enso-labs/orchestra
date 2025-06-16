import { DEFAULT_CHAT_MODEL } from "../config/llm";
import { DEFAULT_SYSTEM_PROMPT } from "../config/instruction";

export const MEMORY_KEY = "enso:chat:payload:memory";
export function getMemory(): boolean {
  if (typeof window === "undefined") return false;
	const memory = window.localStorage.getItem(MEMORY_KEY) ?? null;
	if (memory) {
		return JSON.parse(memory);
	}
	return false;
}

export function toggleMemory() {
  if (typeof window === "undefined") return;
  const memory = getMemory();
  window.localStorage.setItem(MEMORY_KEY, JSON.stringify(!memory));
}

//------------------------------------------------------------------------
export const MODEL_KEY = "enso:chat:payload:model";
export function getModel(): string {
  if (typeof window === "undefined") return DEFAULT_CHAT_MODEL;
	const model = window.localStorage.getItem(MODEL_KEY) ?? null;
	if (model) return model;
	return DEFAULT_CHAT_MODEL;
}

export function setModel(model: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODEL_KEY, model);
}

//------------------------------------------------------------------------
export const SYSTEM_PROMPT_KEY = "enso:chat:payload:system";
export function getSystemPrompt(): string {
  if (typeof window === "undefined") return DEFAULT_SYSTEM_PROMPT;
	const model = window.localStorage.getItem(SYSTEM_PROMPT_KEY) ?? null;
	if (model) return model;
	return DEFAULT_SYSTEM_PROMPT;
}

export function setSystemPrompt(system: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYSTEM_PROMPT_KEY, system);
}