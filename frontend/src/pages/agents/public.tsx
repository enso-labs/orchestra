import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import NoAuthLayout from "@/layouts/NoAuthLayout";
import ChatPanel from "@/pages/chat/ChatPanel";
import { ChatNav } from "@/components/nav/ChatNav";
import AgentService, { Agent } from "@/lib/services/agentService";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import { Computer } from "lucide-react";
import AgentSection from "@/components/sections/agent-section";

export default function PublicAgentPage() {
	const { agentId } = useParams();
	const { setAgent } = useAgentContext();
	const { messages, useModelsEffect } = useChatContext();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [publicAgent, setPublicAgent] = useState<Agent | null>(null);

	useModelsEffect();

	useEffect(() => {
		async function fetchAgent() {
			if (!agentId) return;
			try {
				const response = await AgentService.getPublic(agentId);
				const agent = response.data.assistant;
				setPublicAgent(agent);
				// Set agent in context for ChatPanel to use
				setAgent({
					id: agent.id,
					name: agent.name,
					description: agent.description,
					// model: agent.model || "",
					// tools: [],
					public: true,
				});
			} catch (err) {
				setError("Agent not found or not public");
			} finally {
				setLoading(false);
			}
		}
		fetchAgent();
	}, [agentId, setAgent]);

	if (loading) {
		return (
			<NoAuthLayout>
				<div className="flex items-center justify-center h-full">
					<Computer className="h-8 w-8 animate-pulse text-muted-foreground" />
				</div>
			</NoAuthLayout>
		);
	}

	if (error || !publicAgent) {
		return (
			<NoAuthLayout>
				<div className="text-center py-12">
					<Computer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
					<h3 className="text-lg font-semibold mb-2">Agent Not Found</h3>
					<p className="text-muted-foreground">
						{error || "This agent is not available"}
					</p>
				</div>
			</NoAuthLayout>
		);
	}

	// Show agent info header before chat starts
	if (messages.length === 0) {
		return (
			<NoAuthLayout showModelSelector={false}>
				<AgentSection agent={publicAgent} showAgentMenu={false} />
			</NoAuthLayout>
		);
	}

	// Chat in progress
	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			<ChatPanel chatNav={<ChatNav showModelBadge={false} />} />
		</div>
	);
}
