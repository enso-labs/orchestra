import LLLMConfig from "@/lib/config/llm";
import { useQueryState } from "nuqs";

export function useModel() {
	const [model, setModel] = useQueryState("model");

	if (!model) {
		setModel(LLLMConfig.DEFAULT_CHAT_MODEL);
	}

	return {
		model,
		setModel,
	};
}

export default useModel;