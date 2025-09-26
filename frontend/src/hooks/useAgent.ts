import { useState } from "react";
import ToolConfig from "@/lib/config/tool";

const INIT_AGENT_STATE = {
	agent: {
		name: "",
		description: "",
		system: "You are a helpful assistant.",
		tools: [],
		mcp: ToolConfig.DEFAULT_MCP_CONFIG,
		a2a: ToolConfig.DEFAULT_A2A_CONFIG,
	},
};

export function useAgent() {
	const [agent, setAgent] = useState(INIT_AGENT_STATE.agent);

	const setAgentSystemMessage = (system: string) => {
		setAgent({ ...agent, system });
	};

	return {
		agent,
		setAgent,
		setAgentSystemMessage,
	};
}

export default useAgent;
