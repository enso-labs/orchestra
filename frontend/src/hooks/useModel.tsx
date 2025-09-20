import { useChatContext } from "@/context/ChatContext";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";
import { useEffect } from "react";

import { StringParam, useQueryParam } from "use-query-params";

export function useModel() {
	const { model, setModel } = useChatContext();
	const [queryModel, setQueryModel] = useQueryParam("model", StringParam);

	useEffect(() => {
		// Initialize from query param on mount or when query param changes
		if (queryModel && queryModel !== model) {
			setModel(queryModel);
		} else if (!queryModel && !model) {
			// Set default if neither exists
			setModel(DEFAULT_CHAT_MODEL);
			setQueryModel(DEFAULT_CHAT_MODEL);
		}
	}, [queryModel, setModel, setQueryModel, model]);

	return typeof model === "string" ? model : DEFAULT_CHAT_MODEL;
}
