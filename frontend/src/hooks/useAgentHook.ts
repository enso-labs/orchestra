import { useAppContext } from '@/context/AppContext';
import { toast } from 'sonner';
import { useChatContext } from '@/context/ChatContext';
import { Agent } from '@/entities';
import { createAgent, createAgentRevision, deleteAgent, getAgents } from '@/services/agentService';
import { createSetting } from '@/services/settingService';
import debug from 'debug';
import { useEffect, useMemo, useState } from 'react';

debug.enable('hooks:*');
// const logger = debug('hooks:useAppHook');

const INIT_AGENT_STATE = {
	agents: [],
	fitlered:[],
	selectedAgent: null,
	agentDetails: {
		id: "",
		name: "",
		description: "",
		settings: {
			id: "",
			name: "",
			value: {
				system: "",
			}
		},
		public: false
	}
}

export default function useAgentHook() {
	const { setLoading } = useAppContext();
	const { payload, setPayload } = useChatContext();
	const [agentDetails, setAgentDetails] = useState(INIT_AGENT_STATE.agentDetails);
	const [isCreating, setIsCreating] = useState(false);
	const [agents, setAgents] = useState<Agent[]>(INIT_AGENT_STATE.agents);
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(INIT_AGENT_STATE.selectedAgent);
	const [filteredAgents, setFilteredAgents] = useState<Agent[]>(INIT_AGENT_STATE.agents);
	const publicAgents = useMemo(() => 
		filteredAgents.filter((agent: Agent) => agent.public),
		[agents]
	);
	const privateAgents = useMemo(() => 
		filteredAgents.filter((agent: Agent) => !agent.public),
		[agents]
	);


	const handleCreateAgent = async () => {
    try {
      if (!agentDetails.name.trim()) {
        alert("Please enter a name for your agent");
        return;
      }

      if (!payload.system.trim()) {
        alert("Please enter a system prompt for your agent");
        return;
      }

      setIsCreating(true);
      const response = await createSetting({
        name: agentDetails.name.replace(/\s+/g, '_').toLowerCase() + ":default",
        value: {
          system: payload.system,
          model: payload.model,
          tools: payload.tools,
          mcp: payload.mcp
        }
      });
      const settingId = response.data.setting.id;
      const agentResponse = await createAgent({
        name: agentDetails.name,
        description: agentDetails.description,
        settings_id: settingId,
        public: agentDetails.public
      });
      alert(`Agent created ${agentResponse.agent.name} successfully`);
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert(JSON.stringify(error))
			return false;
    } finally {
      setIsCreating(false);
			return true;
    }
  }

	const handleUpdateAgent = async (id: string) => {
		try {
			if (!agentDetails.name.trim()) {
				alert("Please enter a name for your agent");
				return;
			}

			if (!payload.system.trim()) {
				alert("Please enter a system prompt for your agent");
				return;
			}

			setIsCreating(true);
			const response = await createSetting({
				name: agentDetails.name.replace(/\s+/g, '_').toLowerCase() + ":" + new Date().toISOString().slice(0, 16).replace('T', '_'),
				value: {
					system: payload.system,
					model: payload.model,
					tools: payload.tools,
					mcp: payload.mcp
				}
			});
			const settingId = response.data.setting.id;
			const agentResponse = await createAgentRevision(id, {
				settings_id: settingId,
				name: agentDetails.name,
				description: agentDetails.description,
			});
			alert(`Agent created revision ${agentResponse.data.agent.name} successfully`);
		} catch (error) {
			console.error("Failed to update agent:", error);
			alert(JSON.stringify(error))
		} finally {
			setIsCreating(false);
		}
	}

	const handleSelectAgent = (agent: any) => {
		setPayload((prev: any) => {
			return {
				...prev,
				system: agent.setting.value.system,
				model: agent.setting.value.model,
				tools: agent.setting.value.tools,
				mcp: agent.setting.value.mcp
			}
		});
		setAgentDetails(agent);
	}

	const handleGetAgents = async () => {
		const response = await getAgents();
		setAgents(response.data.agents);
	}

	// Handle agent deletion
  const handleDeleteAgent = async (agentId: string) => {
    if (confirm("Are you sure you want to delete this agent?")) {
      try {
        await deleteAgent(agentId);
        setAgents(prevAgents => prevAgents.filter(agent => agent.id !== agentId));
        toast.success("Agent deleted successfully")
      } catch (error) {
        console.error("Failed to delete agent:", error)
        toast.error("Failed to delete agent")
      }
    }
  }

	const useEffectGetAgents = async() => {
		useEffect(() => {
			const fetchAgents = async () => {
				try {
					setLoading(true)
					await handleGetAgents();
				} catch (error) {
					console.error("Failed to fetch agents:", error)
					toast.error("Failed to load agents")
				} finally {
					setLoading(false)
				}
			}
			fetchAgents();
		}, []);	
	}

	const useEffectGetFilteredAgents = (searchTerm: string, selectedCategories: string[]) => {
		useEffect(() => {
			const filterAgents = (agents: Agent[]) => {
				return agents.filter((agent) => {
					const matchesSearch =
						agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
						agent.description.toLowerCase().includes(searchTerm.toLowerCase())

					const matchesCategories =
						selectedCategories.length === 0 || 
						(agent.categories && selectedCategories.some(cat => agent.categories?.includes(cat)))

					return matchesSearch && matchesCategories
				})
			}

			setFilteredAgents(filterAgents(agents))
		}, [searchTerm, selectedCategories, agents, publicAgents, privateAgents])
	}

	return {
		agentDetails,
		setAgentDetails,
		isCreating,
		handleCreateAgent,
		handleSelectAgent,
		handleUpdateAgent,
		agents,
		handleGetAgents,
		useEffectGetAgents,
		publicAgents,
		privateAgents,
		handleDeleteAgent,
		filteredAgents,
		useEffectGetFilteredAgents,
		selectedAgent,
		setSelectedAgent,
	}
}