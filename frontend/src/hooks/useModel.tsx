import { useChatContext } from "@/context/ChatContext";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";
import { getModel, setModel } from "@/lib/utils/storage";
import { useEffect } from "react";

export function useModel() {
	const { payload, setPayload } = useChatContext();

	useEffect(() => {
		// Initialize model from localStorage on mount
		const model = getModel();
		if (model) {
			setPayload((prev: any) => ({ ...prev, model }));
		}
	}, []);

	useEffect(() => {
		// Update localStorage whenever payload.model changes
		if (typeof payload.model === "string") {
			setModel(payload.model);
		}
	}, [payload.model]);

	return typeof payload.model === "string" ? payload.model : DEFAULT_CHAT_MODEL;
}
