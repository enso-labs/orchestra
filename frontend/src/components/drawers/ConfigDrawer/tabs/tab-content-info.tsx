import { Button } from "@/components/ui/button"
import SelectModel from "@/components/selects/SelectModel"
import { useChatContext } from "@/context/ChatContext"
import SystemMessageCard from "@/components/cards/SystemMessageCard"
import { Switch } from "@/components/ui/switch"
import { useMemory } from "@/hooks/useMemory"

function TabContentInfo() {
	const { payload, setPayload } = useChatContext()

	const handleMemoryToggle = () => {
		setPayload((prev: any) => ({ ...prev, memory: !prev.memory }));
	}

  return (
    <div className="space-y-6">
			<div className="space-y-4">
				<h3 className="text-lg font-medium">Model</h3>
				<SelectModel />
			</div>

			<div className="space-y-4">
				<h3 className="text-lg font-medium">Memory</h3>
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<p className="text-sm font-medium">Enable Memory</p>
						<p className="text-xs text-muted-foreground">
							Allow the AI to remember previous conversations
						</p>
					</div>
					<Switch
						checked={useMemory()}
						onCheckedChange={handleMemoryToggle}
					/>
				</div>
			</div>

			<div className="space-y-4">
				<h3 className="text-lg font-medium">System Prompt</h3>
				<SystemMessageCard content={payload.system} />
				<Button className="mt-4 w-full">Save</Button>
			</div>
		</div>
  )
}

export default TabContentInfo;