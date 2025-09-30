import agentService, { Agent } from "@/lib/services/agentService";
import { useEffect, useState } from "react";
import ToolConfig from "@/lib/config/tool";

export const INIT_AGENT_STATE = {
	agent: {
		name: "",
		description: "",
		system: "You are a helpful assistant.",
		tools: [],
		mcp: {},
		a2a: {},
		subagents: [
			{
				name: "weather_agent",
				// model: "openai:gpt-5-nano",
				description: "You are a weather agent, that speaks like a parrot.",
				tools: ["get_weather"],
				prompt: "You are a weather agent, that speaks like a parrot.",
			},
			{
				name: "stock_agent",
				// model: "openai:gpt-5-nano",
				description: "You are a stock agent, that speaks like a pirate.",
				tools: ["get_stock_price"],
				prompt: "You are a stock agent, that speaks like a pirate.",
			},
		],
	},
	agents: [],
};

export function useAgent() {
	const [agent, setAgent] = useState(INIT_AGENT_STATE.agent);
	const [agents, setAgents] = useState<Agent[]>([]);

	const setAgentSystemMessage = (system: string) => {
		setAgent({ ...agent, system });
	};

	const handleGetAgents = async () => {
		const response = await agentService.search();
		setAgents(response.data.assistants);
	};

	const handleGetAgent = async (id: string) => {
		const response = await agentService.search({
			filter: {
				id: id,
			},
		});
		setAgent({
			...response.data.assistants[0],
			system: response.data.assistants[0].prompt,
		});
	};

	const useEffectGetAgent = (id: string) => {
		useEffect(() => {
			handleGetAgent(id);
		}, [id]);
	};

	const useEffectGetAgents = () => {
		useEffect(() => {
			handleGetAgents();
		}, []);

		return () => {
			setAgents([]);
		};
	};

	const clearMcp = () => {
		setAgent({ ...agent, mcp: {} });
	};

	const clearA2a = () => {
		setAgent({ ...agent, a2a: {} });
	};

	const loadMcpTemplate = () => {
		setAgent({ ...agent, mcp: ToolConfig.DEFAULT_MCP_CONFIG });
	};

	const loadA2aTemplate = () => {
		setAgent({ ...agent, a2a: ToolConfig.DEFAULT_A2A_CONFIG });
	};

	return {
		agent,
		setAgent,
		setAgentSystemMessage,
		agents,
		handleGetAgents,
		useEffectGetAgents,
		useEffectGetAgent,
		handleGetAgent,
		clearMcp,
		clearA2a,
		loadMcpTemplate,
		loadA2aTemplate,
	};
}

export default useAgent;
