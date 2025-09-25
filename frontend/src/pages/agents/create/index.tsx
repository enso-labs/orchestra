import { StringParam, useQueryParam } from "use-query-params";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatPanel from "@/pages/chat/ChatPanel";

function AgentCreatePage() {
	const [activeTab, setActiveTab] = useQueryParam("tab", StringParam);

	const handleTabChange = (value: string) => {
		setActiveTab(value);
	};

	return (
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
				<ChatPanel nav={false} />
			</TabsContent>
		</Tabs>
	);
}

export default AgentCreatePage;
