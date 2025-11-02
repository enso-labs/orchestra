import agentService, { Agent } from "@/lib/services/agentService";
import { useEffect, useState } from "react";
import ToolConfig from "@/lib/config/tool";
import useModel from "./useModel";
import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu";

type Checked = DropdownMenuCheckboxItemProps["checked"];

export type AgentState = {
	agent: Agent;
	agents: Agent[];
};

export const INIT_AGENT_STATE: AgentState = {
	agent: {
		name: "",
		description: "",
		prompt: "",
		tools: ["get_stock_price_history"],
		model: "",
		mcp: {},
		a2a: {},
		subagents: [],
		presidio: {
			analyze: true,
			anonymize: true,
			redact: false,
		},
	},
	agents: [],
};

export function useAgent() {
	const { model } = useModel();
	const [agent, setAgent] = useState<Agent>(INIT_AGENT_STATE.agent);
	const [agents, setAgents] = useState<Agent[]>([]);
	const [webSearchCheck, setWebSearchCheck] = useState<Checked>(() => {
		const saved = localStorage.getItem("enso:tool:search");
		return saved !== null ? JSON.parse(saved) : true;
	});
	const [piiAnalyzeCheck, setPiiAnalyzeCheck] = useState<Checked>(() => {
		const saved = localStorage.getItem("enso:tool:pii_analyze");
		return saved !== null ? JSON.parse(saved) : true;
	});
	const [piiAnonymizeCheck, setPiiAnonymizeCheck] = useState<Checked>(() => {
		const saved = localStorage.getItem("enso:tool:pii_anonymize");
		return saved !== null ? JSON.parse(saved) : true;
	});

	useEffect(() => {
		if (model && agent.model !== model) {
			setAgent({ ...agent, model: model });
		}
	}, [model]);

	useEffect(() => {
		setAgent({
			...agent,
			presidio: {
				analyze: piiAnalyzeCheck ? true : false,
				anonymize: piiAnonymizeCheck ? true : false,
				redact: false,
			},
		});
	}, [piiAnalyzeCheck, piiAnonymizeCheck]);

	const setAgentSystemMessage = (system: string) => {
		setAgent({ ...agent, prompt: system });
	};

	const addAgentToSubagents = (newAgent: Agent) => {
		setAgent({ ...agent, subagents: [...(agent.subagents || []), newAgent] });
	};

	const removeAgentFromSubagents = (agentId: string) => {
		setAgent({
			...agent,
			subagents: (agent.subagents || []).filter(
				(subagent) => subagent.id !== agentId,
			),
		});
	};

	const toggleSubagent = (targetAgent: Agent) => {
		const isSelected = (agent.subagents || []).some(
			(subagent) => subagent.id === targetAgent.id,
		);
		if (isSelected) {
			removeAgentFromSubagents(targetAgent.id!);
		} else {
			addAgentToSubagents(targetAgent);
		}
	};

	const isAgentSelected = (agentId: string) => {
		return (agent.subagents || []).some((subagent) => subagent.id === agentId);
	};

	const setAgentSubagents = (subagents: Agent[]) => {
		setAgent({
			...agent,
			subagents: [...(agent.subagents || []), ...subagents],
		});
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
		setAgentSubagents,
		addAgentToSubagents,
		removeAgentFromSubagents,
		toggleSubagent,
		isAgentSelected,
		webSearchCheck,
		setWebSearchCheck,
		piiAnalyzeCheck,
		setPiiAnalyzeCheck,
		piiAnonymizeCheck,
		setPiiAnonymizeCheck,
	};
}

export default useAgent;
