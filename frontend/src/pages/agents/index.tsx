import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Plus,
	Search,
	Computer,
	Users,
	Star,
	Calendar,
	Zap,
	Network,
	UserCog,
	Globe,
	Lock,
	Share2,
	Loader2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentContext } from "@/context/AgentContext";
import { Agent } from "@/lib/services/agentService";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useChatContext } from "@/context/ChatContext";

function AgentIndexPage() {
	const navigate = useNavigate();
	const {
		agents,
		publicAgents,
		isLoadingAgents,
		isLoadingPublicAgents,
		useEffectGetAgents,
		useEffectGetPublicAgents,
	} = useAgentContext();
	const { clearMessages } = useChatContext();
	const [, setSearchParams] = useSearchParams();
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState<"my-agents" | "public-agents">(
		"my-agents",
	);

	useEffectGetAgents();
	useEffectGetPublicAgents();

	useEffect(() => {
		clearMessages();
		setSearchParams(new URLSearchParams());
	}, []);

	// Simple search on agent name only for user's agents
	const filteredAgents = useMemo(() => {
		if (!searchQuery.trim()) return agents;
		return agents.filter((agent: Agent) =>
			agent.name.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [agents, searchQuery]);

	// Simple search on agent name only for public agents
	const filteredPublicAgents = useMemo(() => {
		if (!searchQuery.trim()) return publicAgents;
		return publicAgents.filter((agent: Agent) =>
			agent.name.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [publicAgents, searchQuery]);

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const handleAgentClick = (agentId: string) => {
		// Navigate to agent detail or chat page
		clearMessages();
		navigate(`/assistant/${agentId}`);
	};

	// Helper to render agent card (reused for both tabs)
	const renderAgentCard = (agent: Agent, isPublicView: boolean = false) => {
		const id = agent.id;
		const clickable = Boolean(id);
		return (
			<Card
				key={id ?? `${agent.name}-${agent.created_at ?? "unknown"}`}
				className={[
					"hover:shadow-lg transition-shadow duration-200 group",
					clickable ? "cursor-pointer" : "opacity-60 cursor-not-allowed",
				].join(" ")}
				onClick={() => {
					if (id) handleAgentClick(id);
				}}
			>
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between">
						<Computer className="h-5 w-5 text-primary flex-shrink-0" />
						<div className="flex items-center gap-2">
							{agent.public && !isPublicView && (
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={(e) => {
										e.stopPropagation();
										navigator.clipboard.writeText(
											`${window.location.origin}/a/${agent.id}`,
										);
										alert("Share link copied to clipboard!");
									}}
									title="Copy share link"
								>
									<Share2 className="h-3 w-3" />
								</Button>
							)}
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
							</div>
						</div>
					</div>
					<CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-2">
						{agent.name}
					</CardTitle>
					<CardDescription className="text-xs line-clamp-3">
						{agent.description}
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="space-y-2">
						{/* Public/Private & MCP, A2A & Subagents Indicators */}
						<div className="flex flex-wrap gap-1">
							{isPublicView ? (
								<Badge variant="default" className="text-xs gap-1">
									<Globe className="h-3 w-3" />
									Public
								</Badge>
							) : agent.public ? (
								<Badge variant="default" className="text-xs gap-1">
									<Globe className="h-3 w-3" />
									Public
								</Badge>
							) : (
								<Badge variant="outline" className="text-xs gap-1">
									<Lock className="h-3 w-3" />
									Private
								</Badge>
							)}
							{agent.mcp && Object.keys(agent.mcp).length > 0 && (
								<Badge variant="secondary" className="text-xs gap-1">
									<Zap className="h-3 w-3" />
									MCP
								</Badge>
							)}
							{agent.a2a && Object.keys(agent.a2a).length > 0 && (
								<Badge variant="secondary" className="text-xs gap-1">
									<Network className="h-3 w-3" />
									A2A
								</Badge>
							)}
							{agent.subagents && agent.subagents.length > 0 && (
								<Badge variant="outline" className="text-xs gap-1">
									<UserCog className="h-3 w-3" />
									{agent.subagents.length}{" "}
									{agent.subagents.length === 1 ? "Subagent" : "Subagents"}
								</Badge>
							)}
						</div>

						{/* Categories */}
						{agent.tools && agent.tools.length > 0 && (
							<div className="flex flex-wrap gap-1">
								{agent.tools.slice(0, 2).map((tool) => (
									<span
										key={tool}
										className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground"
									>
										{tool}
									</span>
								))}
								{agent.tools.length > 2 && (
									<span className="text-xs text-muted-foreground">
										+{agent.tools.length - 2}
									</span>
								)}
							</div>
						)}

						{/* Stats */}
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<div className="flex items-center gap-1">
								<Users className="h-3 w-3" />
							</div>
							<div className="flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								<span>
									{agent.created_at
										? formatDate(agent.created_at)
										: "Invalid date"}
								</span>
							</div>
						</div>

						{/* Model info */}
						{agent.model && (
							<div className="text-xs text-muted-foreground">
								Model: {agent.model}
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		);
	};

	// Helper to render empty state
	const renderEmptyState = (isPublic: boolean) => (
		<div className="text-center py-12">
			<Computer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
			<h3 className="text-lg font-semibold text-foreground mb-2">
				No agents found
			</h3>
			<p className="text-muted-foreground mb-4">
				{searchQuery
					? `No ${isPublic ? "public " : ""}agents match your search for "${searchQuery}"`
					: isPublic
						? "No public agents available at the moment"
						: "You haven't created any agents yet"}
			</p>
			{searchQuery ? (
				<Button variant="outline" onClick={() => setSearchQuery("")}>
					Clear search
				</Button>
			) : !isPublic ? (
				<Button onClick={() => navigate("/assistant/create")}>
					<Plus className="h-4 w-4 mr-2" />
					Create your first agent
				</Button>
			) : null}
		</div>
	);

	// Helper to render loading state
	const renderLoadingState = (message: string) => (
		<div className="flex items-center justify-center py-12">
			<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			<span className="ml-3 text-muted-foreground">{message}</span>
		</div>
	);

	// Helper to get results summary text
	const getResultsSummary = () => {
		if (activeTab === "my-agents") {
			if (isLoadingAgents) {
				return "Loading agents...";
			}
			return filteredAgents.length === agents.length
				? `Showing all ${filteredAgents.length} agents`
				: `Found ${filteredAgents.length} agents matching "${searchQuery}"`;
		} else {
			if (isLoadingPublicAgents) {
				return "Loading public agents...";
			}
			return filteredPublicAgents.length === publicAgents.length
				? `Showing all ${filteredPublicAgents.length} public agents`
				: `Found ${filteredPublicAgents.length} public agents matching "${searchQuery}"`;
		}
	};

	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<ChatNav
					sidebarTrigger={<SidebarTrigger />}
				/>
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					{/* Fixed header section */}
					<div className="flex-shrink-0 px-4 pt-4">
						<div className="mx-auto">
							{/* Page title and search */}
							<div className="mb-5">
								<div className="flex items-center justify-between mb-2">
									<h1 className="text-3xl font-bold text-foreground">
										Assistants
									</h1>
									<MainToolTip content="New Agent" delayDuration={500}>
										<Button
											variant="outline"
											size="icon"
											onClick={() => navigate("/assistant/create")}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</MainToolTip>
								</div>
								<p className="text-muted-foreground mb-6">
									Discover and deploy specialized AI assistants for your
									workflows
								</p>

								{/* Search bar */}
								<div className="relative max-w-md">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										type="text"
										placeholder="Search agents by name..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-10"
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Tabs for My Agents / Public Agents */}
					<div className="flex-1 min-h-0 px-4 pb-4">
						<div className="mx-auto h-full flex flex-col">
							<Tabs
								value={activeTab}
								onValueChange={(v) =>
									setActiveTab(v as "my-agents" | "public-agents")
								}
								className="flex-1 flex flex-col min-h-0"
							>
								<div className="flex items-center justify-between mb-4">
									<TabsList>
										<TabsTrigger value="my-agents" className="gap-2">
											<Lock className="h-3 w-3" />
											My Agents ({agents.length})
										</TabsTrigger>
										<TabsTrigger value="public-agents" className="gap-2">
											<Globe className="h-3 w-3" />
											Public Agents ({publicAgents.length})
										</TabsTrigger>
									</TabsList>

									{/* Results summary */}
									<p className="text-sm text-muted-foreground">
										{getResultsSummary()}
									</p>
								</div>

								{/* My Agents Tab */}
								<TabsContent value="my-agents" className="flex-1 min-h-0 mt-0">
									<ScrollArea className="h-full">
										<div className="pb-4">
											{isLoadingAgents ? (
												renderLoadingState("Loading agents...")
											) : filteredAgents.length > 0 ? (
												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-8">
													{filteredAgents.map((agent: Agent) =>
														renderAgentCard(agent, false),
													)}
												</div>
											) : (
												renderEmptyState(false)
											)}
										</div>
									</ScrollArea>
								</TabsContent>

								{/* Public Agents Tab */}
								<TabsContent
									value="public-agents"
									className="flex-1 min-h-0 mt-0"
								>
									<ScrollArea className="h-full">
										<div className="pb-4">
											{isLoadingPublicAgents ? (
												renderLoadingState("Loading public agents...")
											) : filteredPublicAgents.length > 0 ? (
												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-8">
													{filteredPublicAgents.map((agent: Agent) =>
														renderAgentCard(agent, true),
													)}
												</div>
											) : (
												renderEmptyState(true)
											)}
										</div>
									</ScrollArea>
								</TabsContent>
							</Tabs>
						</div>
					</div>
				</div>
			</div>
		</ChatLayout>
	);
}

export default AgentIndexPage;
