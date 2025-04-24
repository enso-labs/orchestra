import { useToolContext } from "@/context/ToolContext";
import { DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { CheckCircle } from "lucide-react";


/**
 * Displays the MCP header with a title and a close button.
 */
function MCPHeader() {
  const {
    hasSavedMCP,
    cancelAddingMCP,
  } = useToolContext();
  
  return (
    <DialogHeader className="mb-6 pb-4 border-b">
      <div className="flex items-center justify-between">
        <DialogTitle className="text-xl font-semibold flex items-center">
          {hasSavedMCP ? (
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          ) : null}
          {hasSavedMCP ? "MCP Configuration" : "Add MCP Configuration"}
        </DialogTitle>
        <DialogClose onClick={cancelAddingMCP} className="h-7 w-7 p-0 hover:bg-muted rounded-full" />
      </div>
    </DialogHeader>
  );
}

export default MCPHeader;