import * as React from "react";
import {
	ChevronRight,
	Bot,
	// Layers,
	// Wrench,
	MessageSquare,
} from "lucide-react";
// import { VersionSwitcher } from "@/components/menus/version-switcher";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { SettingsPopover } from "../popovers/SettingsPopover";
import { useChatContext } from "@/context/ChatContext";
import {
	formatContent,
	formatMessages,
	truncateFrom,
} from "@/lib/utils/format";
import { useAgentContext } from "@/context/AgentContext";
import { Agent } from "@/lib/services/agentService";
import { formatDistanceToNow } from "date-fns";
import { searchThreads } from "@/lib/services";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";
import useModel from "@/hooks/useModel";
import { Link } from "react-router-dom";
import useLinkClick from "@/hooks/useLinkClick";

interface AssistantItemProps {
	agent: Agent;
	url: string;
}

function AssistantItem({ agent, url }: AssistantItemProps) {
	const { agent: currentAgent } = useAgentContext();
	// const toolsCount = agent.tools?.length || 0;
	// const subagentsCount = agent.subagents?.length || 0;
	// const modelDisplay = agent.model?.split(":")[1] || agent.model || "N/A";
	const isSelected = currentAgent?.id === agent.id;

	return (
		<SidebarMenuItem className="mb-1">
			<SidebarMenuButton
				asChild
				isActive={isSelected}
				className={`h-auto px-3 py-3 rounded-lg border transition-all ${
					isSelected
						? "bg-sidebar-accent border-sidebar-accent shadow-sm"
						: "bg-transparent border-sidebar-border hover:bg-sidebar-accent/50 hover:border-sidebar-accent/50"
				}`}
			>
				<a
					href={url}
					className="flex flex-col items-start gap-1.5 w-full group"
				>
					<div className="flex items-center gap-2.5 w-full">
						<div className="flex flex-col min-w-0 flex-1">
							<span
								className={`text-sm truncate ${
									isSelected
										? "font-semibold text-sidebar-accent-foreground"
										: "font-medium text-sidebar-foreground"
								}`}
							>
								{agent.name}
							</span>
							<span className="text-xs text-sidebar-foreground/60 truncate">
								{agent.description || "No description"}
							</span>
						</div>
					</div>
					{/* <div className="flex items-center gap-2.5 text-[11px] text-sidebar-foreground/50">
						<div className="flex items-center gap-1">
							<Bot className="w-3 h-3" />
							<span>{modelDisplay}</span>
						</div>
						{toolsCount > 0 && (
							<>
								<span className="text-sidebar-foreground/30">•</span>
								<div className="flex items-center gap-1">
									<Wrench className="w-3 h-3" />
									<span>
										{toolsCount} tool{toolsCount !== 1 ? "s" : ""}
									</span>
								</div>
							</>
						)}
						{subagentsCount > 0 && (
							<>
								<span className="text-sidebar-foreground/30">•</span>
								<div className="flex items-center gap-1">
									<Layers className="w-3 h-3" />
									<span>{subagentsCount} sub</span>
								</div>
							</>
						)}
					</div> */}
				</a>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

interface ThreadItemProps {
	thread: any;
	// url: string;
}

function ThreadItem({ thread }: ThreadItemProps) {
	const { metadata, setMessages, setMetadata, setFilesMap } = useChatContext();
	const { isMobile, setOpenMobile } = useSidebar();
	const messages = thread.value?.messages || [];
	const messageCount = messages.length;
	const lastMessage = messages[messages.length - 1];
	const isSelected = metadata?.thread_id === thread.value?.thread_id;
	const { setModel } = useModel();

	// Extract a meaningful title from the content
	const getThreadTitle = () => {
		if (!lastMessage) return "Empty thread";
		const content =
			typeof lastMessage.content === "string"
				? lastMessage.content
				: formatContent(lastMessage.content);
		// Try to extract first line or sentence as title
		const firstLine = content.split("\n")[0];
		return truncateFrom(firstLine, "end", "...", 50);
	};

	const handleThreadClick = async () => {
		const checkpoints = await searchThreads("list_checkpoints", thread.value);

		// Set filesMap by associating files with the last AI message
		if (thread.value.files && Object.keys(thread.value.files).length > 0) {
			const messages = formatMessages(checkpoints[0].values.messages);
			const latestAiMessage = messages
				.slice()
				.reverse()
				.find((msg: any) => ["ai", "assistant"].includes(msg.role));

			if (latestAiMessage) {
				const newFilesMap = new Map();
				newFilesMap.set(latestAiMessage.id, thread.value.files);
				setFilesMap(newFilesMap);
			}
		} else {
			setFilesMap(new Map());
		}

		setModel(
			thread.value.messages[thread.value.messages.length - 1].model ||
				DEFAULT_CHAT_MODEL,
		);
		setMessages(formatMessages(checkpoints[0].values.messages));
		setMetadata(thread.value);
		// Close sidebar on mobile
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	const threadTitle = getThreadTitle();

	// Get the model from the last message
	const model =
		lastMessage?.model?.split(":")[1] || lastMessage?.model || "N/A";

	// Format relative time using date-fns
	const relativeTime = thread.updated_at
		? formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })
		: "";

	return (
		<SidebarMenuItem className="mb-1">
			<SidebarMenuButton
				asChild
				isActive={isSelected}
				className={`h-auto px-3 py-3 rounded-lg border transition-all ${
					isSelected
						? "bg-sidebar-accent border-sidebar-accent shadow-sm"
						: "bg-transparent border-sidebar-border hover:bg-sidebar-accent/50 hover:border-sidebar-accent/50"
				}`}
			>
				<button
					onClick={handleThreadClick}
					className="flex items-start gap-2.5 w-full group"
				>
					<div className="flex flex-col min-w-0 flex-1 gap-1.5">
						<div className="flex items-start justify-between gap-2 w-full">
							<span
								className={`text-sm leading-tight line-clamp-2 ${
									isSelected
										? "font-semibold text-sidebar-accent-foreground"
										: "font-medium text-sidebar-foreground"
								}`}
							>
								{threadTitle}
							</span>
							{relativeTime && (
								<span className="text-[10px] text-sidebar-foreground/40 shrink-0 font-normal mt-0.5 whitespace-nowrap">
									{relativeTime}
								</span>
							)}
						</div>
						<div className="flex items-center gap-2.5 text-[11px] text-sidebar-foreground/50">
							<div className="flex items-center gap-1">
								<span className="font-medium">{messageCount}</span>
								<span>msg{messageCount !== 1 ? "s" : ""}</span>
							</div>
							<span className="text-sidebar-foreground/30">•</span>
							<div className="flex items-center gap-1 truncate">
								<span className="truncate">{model}</span>
							</div>
						</div>
					</div>
				</button>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

interface CollapsibleGroupProps {
	title: string;
	items: any[];
	type: "assistants" | "threads";
}

function CollapsibleGroup({ title, items, type }: CollapsibleGroupProps) {
	const titleIcon =
		type === "assistants" ? (
			<Bot className="w-4 h-4 mr-2" />
		) : (
			<MessageSquare className="w-4 h-4 mr-2" />
		);

	return (
		<Collapsible
			key={title}
			title={`${title} (${items.length} items)`}
			defaultOpen={type === "threads"}
			className="group/collapsible"
		>
			<SidebarGroup className="border-b border-sidebar-border">
				<SidebarGroupLabel
					asChild
					className={`
						group/label text-sidebar-foreground hover:bg-sidebar-accent 
						hover:text-sidebar-accent-foreground text-sm
					`}
				>
					<CollapsibleTrigger>
						{titleIcon}
						{title}
						<ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
					</CollapsibleTrigger>
				</SidebarGroupLabel>
				<CollapsibleContent>
					<SidebarGroupContent className="px-1 pt-2">
						<SidebarMenu className="gap-0">
							{type === "assistants"
								? items.map((item) => (
										<AssistantItem
											key={item.agent.id || item.agent.name}
											agent={item.agent}
											url={item.url}
										/>
									))
								: items.map((item) => <ThreadItem thread={item} />)}
						</SidebarMenu>
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}

// const versions = ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { threads } = useChatContext();
	const { agents } = useAgentContext();

	const assistantsList = agents.map((agent: Agent) => {
		return {
			agent: agent,
			url: `/a/${agent.id}`,
		};
	});

	return (
		<Sidebar {...props} autoFocus={false}>
			<SidebarHeader>
				{/* <VersionSwitcher versions={versions} defaultVersion={versions[0]} /> */}
				<Link
					to="/"
					onClick={useLinkClick("/")}
					className="flex items-center gap-2 m-2"
				>
					<img
						src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
						alt="Logo"
						className="w-8 h-8 rounded-full"
					/>
					<h1 className="text-2xl font-bold text-foreground">Ensō</h1>
				</Link>
				{/* <SearchForm /> */}
			</SidebarHeader>
			<SidebarContent className="gap-0">
				{/* We create a collapsible SidebarGroup for each parent. */}
				<CollapsibleGroup
					title="Assistants"
					items={assistantsList}
					type="assistants"
				/>
				<CollapsibleGroup title="Threads" items={threads} type="threads" />
			</SidebarContent>
			<SidebarFooter>
				<SettingsPopover />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
