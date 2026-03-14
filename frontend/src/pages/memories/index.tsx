import { MemorySettings } from "@/components/settings/MemorySettings";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MemoriesIndexPage() {
	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<ChatNav sidebarTrigger={<SidebarTrigger />} />
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<div className="flex-1 min-h-0">
						<ScrollArea className="h-full">
							<div className="container max-w-4xl mx-auto py-8 space-y-8 px-4">
								<div>
									<h1 className="text-3xl font-bold">Memories</h1>
									<p className="text-muted-foreground">
										Manage what the AI remembers about you.
									</p>
								</div>

								<MemorySettings />
							</div>
						</ScrollArea>
					</div>
				</div>
			</div>
		</ChatLayout>
	);
}
