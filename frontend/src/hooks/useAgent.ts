import { useState } from "react";

const INIT_AGENT_STATE = {
	agent: {
		system: "",
		model: "",
		tools: [],
		a2a: {},
		mcp: {},
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
