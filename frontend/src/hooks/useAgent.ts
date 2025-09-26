import { useState } from "react";

const INIT_AGENT_STATE = {
	agent: {
		name: "",
		description: "",
		system: "You are a helpful assistant.",
		tools: [],
		mcp: {},
		a2a: {},
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
