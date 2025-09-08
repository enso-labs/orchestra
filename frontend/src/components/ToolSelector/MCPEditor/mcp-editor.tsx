import { Button } from "@/components/ui/button";
import { X, Save } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useToolContext } from "@/hooks/useToolContext";

// MCP Editor Components
import MCPInfo from "./mcp-info";
import MCPInfoError from "./mcp-info-error";
import MCPInfoLoad from "./mcp-info-load";
import MCPHeader from "./mcp-header";
import MCPInput from "./mcp-input";
/**
 * Displays an MCP editor with a header, editor, and footer.
 */
export function MCPEditor() {
	const {
		mcpInfo,
		isLoadingMCPInfo,
		mcpInfoError,
		cancelAddingMCP,
		saveMCPConfig,
		handleRemoveMCPConfig,
		mcpCode,
		hasSavedMCP,
	} = useToolContext();
	const [isJsonValid, setIsJsonValid] = useState(true);

	useEffect(() => {
		try {
			if (mcpCode) {
				JSON.parse(mcpCode);
				setIsJsonValid(true);
			}
		} catch {
			setIsJsonValid(false);
		}
	}, [mcpCode]);

	return (
		<div className="p-6">
			<MCPHeader />
			{isLoadingMCPInfo ? (
				<MCPInfoLoad />
			) : mcpInfoError ? (
				<MCPInfoError />
			) : mcpInfo ? (
				<MCPInfo />
			) : (
				<MCPInput isJsonValid={isJsonValid} />
			)}

			<DialogFooter className="mt-6 pt-4 border-t">
				<Button type="button" variant="outline" onClick={cancelAddingMCP}>
					Cancel
				</Button>
				<Button
					type="button"
					variant={hasSavedMCP ? "destructive" : "default"}
					onClick={hasSavedMCP ? handleRemoveMCPConfig : saveMCPConfig}
					disabled={
						(!isJsonValid ||
							!mcpCode ||
							Object.keys(JSON.parse(mcpCode || "{}")).length === 0) &&
						!hasSavedMCP
					}
				>
					{hasSavedMCP ? (
						<>
							<X className="h-4 w-4 mr-2" />
							Remove Configuration
						</>
					) : (
						<>
							<Save className="h-4 w-4 mr-2" />
							Save Configuration
						</>
					)}
				</Button>
			</DialogFooter>
		</div>
	);
}

export default MCPEditor;
