import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import NoAuthLayout from "@/layouts/NoAuthLayout";
import ChatPanel from "@/pages/chat/ChatPanel";
import { ChatNav } from "@/components/nav/ChatNav";
import AgentService, { Agent } from "@/lib/services/agentService";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import { Computer } from "lucide-react";
import AgentSection from "@/components/sections/agent-section";
import { getAuthToken } from "@/lib/utils/auth";

export default function PublicAgentPage() {
	const { agentId } = useParams();
	const { setAgent } = useAgentContext();
	const { messages, useModelsEffect } = useChatContext();
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [publicAgent, setPublicAgent] = useState<Agent | null>(null);
	const [isForking, setIsForking] = useState(false);
	const [remixError, setRemixError] = useState<string | null>(null);

	useModelsEffect();

	const handleRemix = useCallback(async () => {
		if (!agentId) return;

		const token = getAuthToken();
		if (!token) {
			navigate(`/login?remix=${agentId}`);
			return;
		}

		setIsForking(true);
		setRemixError(null);
		try {
			const response = await AgentService.fork(agentId);
			const newAssistantId = response.data.assistant_id;
			navigate(`/assistant/${newAssistantId}`);
		} catch {
			setRemixError("Failed to remix agent");
		} finally {
			setIsForking(false);
		}
	}, [agentId, navigate]);

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
					model: agent.model || "",
					tools: agent.tools || [],
					public: true,
				});
			} catch (_err) {
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
			<NoAuthLayout>
				<AgentSection
					agent={publicAgent}
					showAgentMenu={false}
					onRemix={handleRemix}
					isForking={isForking}
				/>
				{remixError && (
					<p className="text-center text-sm text-destructive-accent mt-2">
						{remixError}
					</p>
				)}
			</NoAuthLayout>
		);
	}

	// Chat in progress
	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			<ChatPanel chatNav={<ChatNav />} />
		</div>
	);
}
