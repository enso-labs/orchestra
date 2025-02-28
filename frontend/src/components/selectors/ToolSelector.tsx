import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Wrench, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useChatContext } from "@/context/ChatContext";


export function ToolSelector() {
  const { availableTools, payload, setPayload, useToolsEffect } = useChatContext();

  const toggleTool = (toolId: string) => {
    setPayload((prev: { tools: any[]; }) => {
      const currentTools = prev.tools || [];
      const isSelected = currentTools.includes(toolId);
      
      return {
        ...prev,
        tools: isSelected 
          ? currentTools.filter(id => id !== toolId)
          : [...currentTools, toolId]
      };
    });
  };

  const clearTools = () => {
    setPayload((prev: { tools: any[]; }) => ({
      ...prev,
      tools: []
    }));
  };

  const enabledCount = payload.tools?.length || 0;

  useToolsEffect();

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* <Button 
          variant="outline" 
          size={enabledCount > 0 ? "default" : "icon"}
          className={enabledCount > 0 ? "px-3" : "w-9 h-9"}
          title="Select Tools"
        >
          <Wrench className="h-4 w-4" />
        </Button> */}
        <Button
          variant="outline"
          className="rounded-full bg-foreground/10 text-foreground-500 px-3"
        >
          <Wrench className="h-4 w-4" /> {enabledCount > 0 && `(${enabledCount})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 mr-2" align="start">
        <ScrollArea className="h-72">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium leading-none">
                Tools ({enabledCount} enabled)
              </h4>
              {enabledCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-muted-foreground hover:text-foreground"
                  onClick={clearTools}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <div className="grid gap-2">
              {availableTools.map((tool: any) => (
                <div key={tool.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={tool.id}
                    checked={payload.tools?.includes(tool.id)}
                    onCheckedChange={() => toggleTool(tool.id)}
                  />
                  <div className="grid gap-1.5">
                    <label 
                      htmlFor={tool.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {tool.id}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {tool.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
} 