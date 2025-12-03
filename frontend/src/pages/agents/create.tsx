import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatPanel from "@/pages/chat/ChatPanel";
import { AgentCreateForm } from "@/components/forms/agents/agent-create-form";
import { useChatContext } from "@/context/ChatContext";
import ListThreads from "@/components/lists/ListThreads";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAgentContext } from "@/context/AgentContext";
import { INIT_AGENT_STATE } from "@/hooks/useAgent";
import { useQueryState } from "nuqs";
import ChatLayout from "@/layouts/chat-layout-v2";
import { SidebarTrigger } from "@/components/ui/sidebar";

function AgentCreatePage() {
	const { agent, setAgent, useEffectGetAgents } = useAgentContext();
	const { threads, useListThreadsEffect, messages } = useChatContext();
	const [activeTab, setActiveTab] = useQueryState("tab");
	const [, setSearchParams] = useSearchParams();
	const navigate = useNavigate();

	useEffectGetAgents();

	const handleTabChange = (value: string) => {
		setActiveTab(value);
	};

	useListThreadsEffect();

	useEffect(() => {
		// Only clear search params if there are none on init
		const params = new URLSearchParams(window.location.search);
		if (!Array.from(params.keys()).length) {
			setSearchParams(new URLSearchParams());
		}
	}, []);

	useEffect(() => {
		if (messages.length > 0) {
			setActiveTab("preview");
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
		};
	}, []);

	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<div className="flex items-center justify-between px-4 pt-4 pb-2">
					<div className="flex items-center gap-2">
						<SidebarTrigger />
						<Tabs
							defaultValue="config"
							value={activeTab || "config"}
							onValueChange={handleTabChange}
							className="ml-2"
						>
							<TabsList>
								<TabsTrigger value="config">Config</TabsTrigger>
								<TabsTrigger value="preview">Preview</TabsTrigger>
								<TabsTrigger value="threads">Threads</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</div>

				<Tabs
					defaultValue="config"
					value={activeTab || "config"}
					onValueChange={handleTabChange}
					className="flex-1 flex flex-col min-h-0"
				>
					<TabsContent value="config" className="flex-1 min-h-0 m-0 p-4">
						<ScrollArea className="h-full">
							<AgentCreateForm />
						</ScrollArea>
					</TabsContent>
					<TabsContent value="preview" className="flex-1 min-h-0 m-0">
						<div className="h-full">
							<ChatPanel />
						</div>
					</TabsContent>
					<TabsContent value="threads" className="flex-1 min-h-0 m-0 p-4">
						<ScrollArea className="h-full">
							<div className="p-2 space-y-2">
								<ListThreads threads={threads} />
							</div>
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</div>
		</ChatLayout>
	);
}

export default AgentCreatePage;
