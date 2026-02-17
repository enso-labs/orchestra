import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatPanel from "@/pages/chat/ChatPanel";
import { AgentCreateForm } from "@/components/forms/agents/agent-create-form";
import { useChatContext } from "@/context/ChatContext";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams, useSearchParams } from "react-router-dom";
import { useAgentContext } from "@/context/AgentContext";
import { INIT_AGENT_STATE } from "@/hooks/useAgent";
import { useQueryState } from "nuqs";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";

const DEFAULT_TAB = "assistant";
function AgentEditPage() {
	const { agentId } = useParams();
	const { agent, setAgent, useEffectGetAgent, useEffectGetAgents } =
		useAgentContext();
	useEffectGetAgent(agentId!);
	useEffectGetAgents();

	const {
		useListThreadsEffect,
		messages,
		useEffectUpdateAssistantId,
		useModelsEffect,
		fromBackendFormat,
		clearFileSystem,
	} = useChatContext();
	useModelsEffect();
	const [activeTab, setActiveTab] = useQueryState("tab");
	const [, setSearchParams] = useSearchParams();

	useEffectUpdateAssistantId();

	const handleTabChange = (value: string) => {
		setActiveTab(value);
	};

	useListThreadsEffect(null, { assistant_id: agentId });

	useEffect(() => {
		// Only clear search params if there are none on init
		const params = new URLSearchParams(window.location.search);
		if (!Array.from(params.keys()).length) {
			setSearchParams(new URLSearchParams());
		}
	}, []);

	useEffect(() => {
		if (messages.length > 0) {
			setActiveTab(DEFAULT_TAB);
		}
	}, [messages]);

	useEffect(() => {
		setAgent({
			...agent,
			mcp: {},
			a2a: {},
		});
		return () => {
			setSearchParams(new URLSearchParams());
			setAgent(INIT_AGENT_STATE.agent);
			clearFileSystem();
		};
	}, []);

	// Sync agent.file_system to fileSystem when agent loads
	useEffect(() => {
		if (agent?.files && Object.keys(agent.files).length > 0) {
			fromBackendFormat(agent.files);
		}
	}, [agent?.id, fromBackendFormat]);

	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<div className="flex items-center justify-between px-4 pt-4 pb-2">
					<div className="flex items-center gap-2">
						<SidebarTrigger />
						<Tabs
							defaultValue="config"
							value={activeTab || DEFAULT_TAB}
							onValueChange={handleTabChange}
							className="ml-2"
						>
							<TabsList>
								<TabsTrigger value={DEFAULT_TAB}>Assistant</TabsTrigger>
								<TabsTrigger value="config">Config</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
					<ChatNav sidebarTrigger={null} />
				</div>

				<Tabs
					defaultValue="config"
					value={activeTab || DEFAULT_TAB}
					onValueChange={handleTabChange}
					className="flex-1 flex flex-col min-h-0"
				>
					<TabsContent value={DEFAULT_TAB} className="flex-1 min-h-0 m-0">
						<div className="h-full">
							<ChatPanel agent={agent} showAgentMenu={false} />
						</div>
					</TabsContent>
					<TabsContent value="config" className="flex-1 min-h-0 m-0 p-4">
						<ScrollArea className="h-full">
							<AgentCreateForm />
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</div>
		</ChatLayout>
	);
}

export default AgentEditPage;
