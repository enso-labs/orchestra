import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/drawers/app-sidebar";


export function ChatLayout({ children }: { children: React.ReactNode }) {
	const defaultOpen = true;

	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<AppSidebar />
			<main className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<SidebarTrigger className="m-2" />
				{children}
			</main>
		</SidebarProvider>
	);
}

export default ChatLayout;