import { Loader2 } from "lucide-react";

/**
 * Displays a loading indicator for MCP information.
 */
function MCPInfoLoad() {
	return (
		<div className="text-center py-8 space-y-3">
			<Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
			<p className="text-sm text-muted-foreground">
				Loading MCP information...
			</p>
		</div>
	);
}

export default MCPInfoLoad;
