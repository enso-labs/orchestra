import MCPIcon from "@/components/icons/MCPIcon";
import ModalBase from "../ModalBase";
import MCPEditor from "@/components/ToolSelector/MCPEditor/mcp-editor";
import { useToolContext } from "@/hooks/useToolContext";

function ModalMcp() {
	const { isAddingMCP, setIsAddingMCP, mcpCode, hasSavedMCP } =
		useToolContext();

	return (
		<ModalBase
			icon={<MCPIcon />}
			content={<MCPEditor />}
			enabledCount={Object.keys(JSON.parse(mcpCode) || {}).length}
			isOpen={isAddingMCP}
			setIsOpen={setIsAddingMCP}
			label={hasSavedMCP ? "Edit MCP Configuration" : "Add MCP Configuration"}
		/>
	);
}

export default ModalMcp;
