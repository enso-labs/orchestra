import { useAgentContext } from "@/context/AgentContext";
import LLLMConfig from "@/lib/config/llm";
import { useEffect } from "react";

import { StringParam, useQueryParam } from "use-query-params";

export function useModel() {
	const { agent, setAgent } = useAgentContext();
	const [queryModel, setQueryModel] = useQueryParam("model", StringParam);

	useEffect(() => {
		// Initialize from query param on mount or when query param changes
		if (queryModel && queryModel !== agent.model) {
			setAgent({ ...agent, model: queryModel });
		} else if (!queryModel && !agent.model) {
			// Set default if neither exists
			setAgent({ ...agent, model: LLLMConfig.DEFAULT_CHAT_MODEL });
			setQueryModel(LLLMConfig.DEFAULT_CHAT_MODEL);
		}
	}, [queryModel, setAgent, setQueryModel, agent.model]);

	return typeof agent.model === "string"
		? agent.model
		: LLLMConfig.DEFAULT_CHAT_MODEL;
}
