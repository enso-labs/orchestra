import { Button } from "@/components/ui/button"
import SelectModel from "@/components/selects/SelectModel"
import { useChatContext } from "@/context/ChatContext"
import SystemMessageCard from "@/components/cards/SystemMessageCard"
import { Switch } from "@/components/ui/switch"
import { useMemory } from "@/hooks/useMemory"
import { useSystem } from "@/hooks/useSystem"
import { useState } from "react"

function TabContentInfo() {
	const { payload, setPayload } = useChatContext()
	const [completed, setCompleted] = useState(false)

	const handleMemoryToggle = () => {
		setPayload((prev: any) => ({ ...prev, memory: !prev.memory }));
	}

	const handleSaveSystemPrompt = () => {
		setPayload((prev: any) => ({ ...prev, system: payload.system }));
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
				<SystemMessageCard content={useSystem()} />
				<Button 
					className="mt-4 w-full" 
					onClick={() => {
						handleSaveSystemPrompt();
						alert("System prompt saved");
					}}
				>
					{completed ? "Saved!" : "Save"}
				</Button>
			</div>
		</div>
  )
}

export default TabContentInfo;