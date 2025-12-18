import { ApiTokensSettings } from "@/components/settings/ApiTokensSettings";
import { ModelVisibilitySettings } from "@/components/settings/ModelVisibilitySettings";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SettingsPage() {
	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<ChatNav
					sidebarTrigger={<SidebarTrigger />}
					showModelSelector={false}
				/>
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<div className="flex-1 min-h-0">
						<ScrollArea className="h-full">
							<div className="container max-w-4xl mx-auto py-8 space-y-8 px-4">
								<div>
									<h1 className="text-3xl font-bold">Settings</h1>
									<p className="text-muted-foreground">
										Manage your account settings and preferences.
									</p>
								</div>

								<ApiTokensSettings />
								<ModelVisibilitySettings />
							</div>
						</ScrollArea>
					</div>
				</div>
			</div>
		</ChatLayout>
	);
}
