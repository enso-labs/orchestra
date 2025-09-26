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
import { useNavigate, useSearchParams } from "react-router-dom";
import HouseIcon from "@/components/icons/HouseIcon";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { useAgentContext } from "@/context/AgentContext";

function AgentCreatePage() {
	const { agent, setAgent } = useAgentContext();
	const { threads, useListThreadsEffect, metadata } = useChatContext();
	const [activeTab, setActiveTab] = useQueryParam("tab", StringParam);
	const [, setSearchParams] = useSearchParams();
	const navigate = useNavigate();

	const handleTabChange = (value: string) => {
		setActiveTab(value);
	};

	useListThreadsEffect();

	useEffect(() => {
		setActiveTab("preview");
	}, [metadata]);

	useEffect(() => {
		return () => {
			setSearchParams(new URLSearchParams());
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
				value={activeTab || "config"}
				onValueChange={handleTabChange}
				className="h-full flex flex-col"
			>
				<div className="px-4 pt-4">
					<TabsList>
						<TabsTrigger value="home" onClick={() => navigate("/")}>
							<HouseIcon />
						</TabsTrigger>
						<TabsTrigger value="config">Config</TabsTrigger>
						<TabsTrigger value="preview">Preview</TabsTrigger>
						<TabsTrigger value="threads">Threads</TabsTrigger>
						<TabsTrigger value="tools">Tools</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="config" className="flex-1 p-4">
					<AgentCreateForm />
				</TabsContent>
				<TabsContent value="preview" className="flex-1 h-0">
					<div className="h-full">
						<ChatPanel />
					</div>
				</TabsContent>
				<TabsContent value="threads" className="flex-1 p-4 h-0">
					<ScrollArea className="h-full flex-1">
						<div className="p-2 space-y-2">
							<ListThreads threads={threads} />
						</div>
					</ScrollArea>
				</TabsContent>
				<TabsContent value="tools" className="flex-1 p-4 h-0">
					<Accordion type="single" collapsible>
						<AccordionItem value="mcp">
							<AccordionTrigger>MCP</AccordionTrigger>
							<AccordionContent>
								<Textarea
									className="h-full"
									placeholder="MCP"
									rows={10}
									onChange={(e) =>
										setAgent({ ...agent, mcp: JSON.parse(e.target.value) })
									}
								>
									{JSON.stringify(agent.mcp, null, 2)}
								</Textarea>
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value="a2a">
							<AccordionTrigger>A2A</AccordionTrigger>
							<AccordionContent>
								<Textarea
									className="h-full"
									placeholder="A2A"
									rows={8}
									onChange={(e) =>
										setAgent({ ...agent, a2a: JSON.parse(e.target.value) })
									}
								>
									{JSON.stringify(agent.a2a, null, 2)}
								</Textarea>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default AgentCreatePage;
