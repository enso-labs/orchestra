import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Tab = {
  label: string;
  content: React.ReactNode;
}

const DEFAULT_TABS: Tab[] = [
	{
		label: "MCP",
		content: <div>Tab 1</div>,
	},
	{
		label: "A2A",
		content: <div>Tab 2</div>,
	},
]

function TabsBase({ 
	tabs = DEFAULT_TABS,
	fullWidth = false
}: { 
	tabs?: Tab[],
	fullWidth?: boolean
}) {
  return (
    <Tabs defaultValue={tabs[0].label}>
      <TabsList className={fullWidth? 'grid w-full grid-cols-2 bg-secondary rounded-md' : ''}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.label} value={tab.label}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
			{tabs.map((tab) => (
				<TabsContent key={tab.label} value={tab.label}>
					{tab.content}
				</TabsContent>
			))}
    </Tabs>
  )
}

export default TabsBase;