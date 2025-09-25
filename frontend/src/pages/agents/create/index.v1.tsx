import ChatLayout from "@/layouts/ChatLayout";
import { StringParam, useQueryParam } from "use-query-params";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import ChatPanel from "@/pages/chat/ChatPanel";
import { useChatContext } from "@/context/ChatContext";
import HomeSection from "@/components/sections/home";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function RenderChat() {
	const { messages } = useChatContext();

	if (messages.length === 0) {
		return <HomeSection />;
	}

	return <ChatPanel nav={false} />;
}

function AgentCreatePage() {
	const [activeTab, setActiveTab] = useQueryParam("tab", StringParam);

	const handleTabChange = (value: string) => {
		setActiveTab(value);
	};

	return (
		<div className="flex-1 flex flex-col items-center justify-center bg-background">
			<div className="absolute top-4 right-4">
				<div className="flex flex-row gap-2 items-center">
					<div className="flex-shrink-0">
						<ColorModeButton />
					</div>
				</div>
			</div>

			<Tabs
				defaultValue="config"
				value={activeTab || "config"}
				onValueChange={handleTabChange}
			>
				<div className="absolute top-4 left-4">
					<TabsList>
						<TabsTrigger value="config">Config</TabsTrigger>
						<TabsTrigger value="preview">Preview</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="config">
					Make changes to your account here.
				</TabsContent>
				<TabsContent value="preview">
					<RenderChat />
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default AgentCreatePage;
