import { Agent } from "@/lib/services/agentService";

export type PromptMode = "instructions" | "system_prompt";

export const getPromptConfig = (agent?: Agent) => {
	const instructions = agent?.instructions || agent?.prompt || "";
	const system_prompt = agent?.system_prompt || "";
	const mode: PromptMode =
		system_prompt && system_prompt.trim().length > 0
			? "system_prompt"
			: "instructions";

	return {
		mode,
		content: system_prompt || instructions,
		instructions: instructions || undefined,
		system_prompt: system_prompt || undefined,
	};
};

export const buildPromptPayload = (
	mode: PromptMode,
	content: string,
): { instructions?: string; system_prompt?: string } => {
	if (mode === "system_prompt") {
		return { system_prompt: content || undefined };
	}
	return { instructions: content || undefined };
};
