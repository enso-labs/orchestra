import MCPIcon from "@/components/icons/MCPIcon";
import ModalBase from "../ModalBase";
import MCPEditor from "@/components/ToolSelector/MCPEditor/mcp-editor";
import { useToolContext } from "@/context/ToolContext";

function ModalMcp() {
	const { isAddingMCP, setIsAddingMCP, mcpCode } = useToolContext();

	return (
		<ModalBase 
			icon={<MCPIcon />} 
			content={<MCPEditor />}
			enabledCount={Object.keys(JSON.parse(mcpCode) || {}).length} 
			isOpen={isAddingMCP}
			setIsOpen={setIsAddingMCP}
		/>
	)
}

export default ModalMcp;