// import { Calendar, Home, Inbox, Search, Settings, Users, MessageSquare, FileText } from "lucide-react"
import {
	// Sidebar,
	// SidebarContent,
	SidebarProvider,
	SidebarTrigger,
	// SidebarGroup,
	// SidebarGroupLabel,
	// SidebarGroupContent,
	// SidebarMenu,
	// SidebarMenuItem,
	// SidebarMenuButton,
} from "@/components/ui/sidebar";
// import { Link, useLocation } from "react-router-dom"
// import { cn } from "@/lib/utils"
import { useAppContext } from "@/context/AppContext";

// // Menu items with proper routing and grouping
// const menuItems = [
// 	{
// 		group: "Main",
// 		items: [
// 			{
// 				title: "Dashboard",
// 				url: "/dashboard",
// 				icon: Home,
// 			},
// 			{
// 				title: "Agents",
// 				url: "/agents",
// 				icon: Users,
// 			},
// 			{
// 				title: "Chats",
// 				url: "/chats",
// 				icon: MessageSquare,
// 			},
// 		]
// 	},
// 	{
// 		group: "Tools",
// 		items: [
// 			{
// 				title: "Documents",
// 				url: "/documents",
// 				icon: FileText,
// 			},
// 			{
// 				title: "Calendar",
// 				url: "/calendar",
// 				icon: Calendar,
// 			},
// 			{
// 				title: "Search",
// 				url: "/search",
// 				icon: Search,
// 			},
// 		]
// 	},
// 	{
// 		group: "Settings",
// 		items: [
// 			{
// 				title: "Settings",
// 				url: "/settings",
// 				icon: Settings,
// 			},
// 		]
// 	},
// ]

// export function AppSidebar() {
// 	const location = useLocation()

// 	return (
// 		<Sidebar className="border-r border-border/40">
// 			<SidebarContent>
// 				{menuItems.map((group) => (
// 					<SidebarGroup key={group.group}>
// 						<SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
// 							{group.group}
// 						</SidebarGroupLabel>
// 						<SidebarGroupContent>
// 							<SidebarMenu>
// 								{group.items.map((item) => (
// 									<SidebarMenuItem key={item.title}>
// 										<SidebarMenuButton asChild>
// 											<Link
// 												to={item.url}
// 												className={cn(
// 													"flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
// 													"hover:bg-accent hover:text-accent-foreground",
// 													location.pathname === item.url
// 														? "bg-accent text-accent-foreground"
// 														: "text-muted-foreground"
// 												)}
// 											>
// 												<item.icon className="h-4 w-4" />
// 												<span className="text-sm font-medium">{item.title}</span>
// 											</Link>
// 										</SidebarMenuButton>
// 									</SidebarMenuItem>
// 								))}
// 							</SidebarMenu>
// 						</SidebarGroupContent>
// 					</SidebarGroup>
// 				))}
// 			</SidebarContent>
// 		</Sidebar>
// 	)
// }

function SideDrawerLayout({
	children,
	drawer,
}: {
	children: React.ReactNode;
	drawer: React.ReactNode;
}) {
	const { handleMenuOpen } = useAppContext();
	return (
		<SidebarProvider>
			<div className="flex h-screen bg-background">
				{drawer}
				<main>
					<div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-8">
						<SidebarTrigger
							className="fixed top-4 left-4 z-50"
							onClick={handleMenuOpen}
						/>
					</div>
					<div>{children}</div>
				</main>
			</div>
		</SidebarProvider>
	);
}

export default SideDrawerLayout;
