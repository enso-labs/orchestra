import { Button } from "@/components/ui/button"
import SelectModel from "@/components/selects/SelectModel"
import { useChatContext } from "@/context/ChatContext"
import SystemMessageCard from "@/components/cards/SystemMessageCard"

function TabContentInfo() {
	const { payload } = useChatContext()
  return (
    <div className="space-y-6">
			<div className="space-y-4">
				<h3 className="text-lg font-medium">Model</h3>
				<SelectModel />
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