import { useChatContext } from '@/context/ChatContext';
import { createAgent, createAgentRevision } from '@/services/agentService';
import { createSetting } from '@/services/settingService';
import debug from 'debug';
import { useState } from 'react';

debug.enable('hooks:*');
// const logger = debug('hooks:useAppHook');

const INIT_AGENT_STATE = {
	agentDetails: {
		name: "",
		description: "",
		settings_id: "",
		public: false
	}
}

export default function useAgentHook() {
	const { payload, setPayload } = useChatContext();
	const [agentDetails, setAgentDetails] = useState(INIT_AGENT_STATE.agentDetails);
	const [isCreating, setIsCreating] = useState(false);

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
    } finally {
      setIsCreating(false);
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

	return {
		agentDetails,
		setAgentDetails,
		isCreating,
		handleCreateAgent,
		handleSelectAgent,
		handleUpdateAgent
	}
}