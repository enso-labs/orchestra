import { StringParam, useQueryParam } from "use-query-params";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatPanel from "@/pages/chat/ChatPanel";
import NewThreadButton from "@/components/buttons/NewThreadButton";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { AgentCreateForm } from "@/components/forms/agents/agent-create-form";
import { useChatContext } from "@/context/ChatContext";
import ListThreads from "@/components/lists/ListThreads";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAgentContext } from "@/context/AgentContext";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { INIT_AGENT_STATE } from "@/hooks/useAgent";

function AgentEditPage() {
	const { agentId } = useParams();
	const { agent, setAgent, useEffectGetAgent, useEffectGetAgents } =
		useAgentContext();
	useEffectGetAgent(agentId);
	useEffectGetAgents();

	const {
		threads,
		useListThreadsEffect,
		messages,
		useEffectUpdateAssistantId,
	} = useChatContext();
	const [activeTab, setActiveTab] = useQueryParam("tab", StringParam);
	const [, setSearchParams] = useSearchParams();
	const navigate = useNavigate();

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
			setActiveTab("chat");
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
		<div className="h-full flex flex-col">
			<div className="absolute top-4 right-4">
				<div className="flex flex-row gap-2 items-center">
					<NewThreadButton />
					<ColorModeButton />
				</div>
			</div>
			<Tabs
				defaultValue="config"
				value={activeTab || "chat"}
				onValueChange={handleTabChange}
				className="h-full flex flex-col"
			>
				<div className="px-4 pt-4 flex flex-row gap-1 items-center">
					<MainToolTip content="Agents" delayDuration={500}>
						<Button
							variant="outline"
							size="icon"
							onClick={() => navigate("/agents")}
						>
							<Bot />
						</Button>
					</MainToolTip>
					<TabsList>
						<TabsTrigger value="chat">Chat</TabsTrigger>
						<TabsTrigger value="threads">Threads</TabsTrigger>
						<TabsTrigger value="config">Config</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="chat" className="flex-1 h-0">
					<div className="h-full">
						<ChatPanel agent={agent} showAgentMenu={false} />
					</div>
				</TabsContent>
				<TabsContent value="threads" className="flex-1 p-4 h-0">
					<ScrollArea className="h-full flex-1">
						<div className="p-2 space-y-2">
							<ListThreads threads={threads} />
						</div>
					</ScrollArea>
				</TabsContent>
				<TabsContent value="config" className="flex-1 p-4 h-0">
					<ScrollArea className="h-full">
						<AgentCreateForm />
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default AgentEditPage;
