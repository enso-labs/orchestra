import { useToolContext } from "@/context/ToolContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Displays the available MCP tools in a scrollable area.
 */
function MCPInfo() {
  const { mcpInfo } = useToolContext();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center">
        Available MCP tools:
      </h3>
      
      <ScrollArea className="h-[350px] pr-3 border rounded-md bg-muted/30 p-4">
        <div className="space-y-3">
          {mcpInfo.map((tool: any, index: number) => (
            <div key={index} className="border rounded-md p-4 bg-card hover:shadow-sm transition-shadow">
              <h4 className="font-medium text-primary flex items-center justify-between">
                {tool.name}
                <Badge variant="outline" className="ml-2 text-xs">tool</Badge>
              </h4>
              <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
              {tool.args && Object.keys(tool.args).length > 0 && (
                <div className="mt-3 pt-2 border-t border-dashed">
                  <p className="text-xs font-medium mb-1">Arguments:</p>
                  <ul className="text-xs space-y-1">
                    {Object.entries(tool.args).map(([key, arg]) => (
                      <li key={key} className="flex items-center">
                        <span className="font-mono text-primary-foreground/80">{key}:</span> 
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {(arg as any).type || 'string'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default MCPInfo;