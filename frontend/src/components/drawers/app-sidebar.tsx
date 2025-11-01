import * as React from "react";
import { ChevronRight } from "lucide-react";

import { SearchForm } from "@/components/forms/search-form";
import { VersionSwitcher } from "@/components/menus/version-switcher";
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
} from "@/components/ui/sidebar";
import { SettingsPopover } from "../popovers/SettingsPopover";
import { useChatContext } from "@/context/ChatContext";
import { formatContent, truncateFrom } from "@/lib/utils/format";
import { useAgentContext } from "@/context/AgentContext";

function CollapsibleGroup(item: { title: string, items: any[] }) {
	return (
		<Collapsible
			key={item.title}
			title={item.title + " (" + item.items.length + " items)"}
			// defaultOpen
			className="group/collapsible"
		>
			<SidebarGroup className="border-b border-border">
				<SidebarGroupLabel
					asChild
					className={`
						"group/label text-sidebar-foreground 
						hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"	
					`}
				>
					<CollapsibleTrigger>
						{item.title}{" "}
						<ChevronRight
							className={`
								ml-auto transition-transform 
								group-data-[state=open]/collapsible:rotate-90
							`}
						/>
					</CollapsibleTrigger>
				</SidebarGroupLabel>
				<CollapsibleContent>
					<SidebarGroupContent>
						<SidebarMenu>
							{item.items.map((subItem) => (
								<SidebarMenuItem key={subItem.title} className="text-gray-400 rounded-md border">
									<SidebarMenuButton asChild>
										<a href={subItem.url}>{subItem.title}</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}

const versions = ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { threads } = useChatContext();
	const { agents } = useAgentContext();

	const threadsList = threads.map((thread: any) => {
		const lastMessage = thread.value.messages[thread.value.messages.length - 1];
		const lastMessageContent = truncateFrom(formatContent(lastMessage.content), "end", "...", 70);
		return {
			title: lastMessageContent,
			url: `/t/${thread.value.thread_id}`,
		};
	});

	const assistantsList = agents.map((agent: any) => {
		return {
			title: agent.name,
			url: `/a/${agent.id}`,
		};
	});

	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<VersionSwitcher versions={versions} defaultVersion={versions[0]} />
				<SearchForm />
			</SidebarHeader>
			<SidebarContent className="gap-0">
				{/* We create a collapsible SidebarGroup for each parent. */}
				<CollapsibleGroup title="Assistants" items={assistantsList} />
				<CollapsibleGroup title="Threads" items={threadsList} />
			</SidebarContent>
			<SidebarFooter>
				<SettingsPopover />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
