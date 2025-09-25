import { StringParam, useQueryParam } from "use-query-params";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatPanel from "@/pages/chat/ChatPanel";

function AgentCreatePage() {
	const [activeTab, setActiveTab] = useQueryParam("tab", StringParam);

	const handleTabChange = (value: string) => {
		setActiveTab(value);
	};

	return (
		<div className="h-full flex flex-col">
			<Tabs
				defaultValue="config"
				value={activeTab || "config"}
				onValueChange={handleTabChange}
				className="h-full flex flex-col"
			>
				<div className="px-4 pt-4">
					<TabsList>
						<TabsTrigger value="config">Config</TabsTrigger>
						<TabsTrigger value="preview">Preview</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="config" className="flex-1 p-4">
					Make changes to your account here.
				</TabsContent>
				<TabsContent value="preview" className="flex-1 h-0">
					<div className="h-full">
						<ChatPanel nav={false} />
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default AgentCreatePage;
