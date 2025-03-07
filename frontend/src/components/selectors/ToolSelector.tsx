import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { 
  Wrench, X, Compass, Brain, Feather, Cloud, Database, 
  Search, BookOpen, Globe, Infinity, Leaf, Play
} from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { useState, useEffect } from "react";

// Map of tool icons - in a real implementation, you might want to map specific tool IDs to specific icons
const TOOL_ICONS: Record<string, any> = {
  default: Wrench,
  search: Search,
  search_engine: Search,
  knowledge: BookOpen,
  web: Globe,
  database: Database,
  filestore: Feather,
  assistant: Brain,
  weather: Cloud,
  navigation: Compass,
  meditation: Infinity,
  nature: Leaf,
};

// CSS for animations
const animationStyles = `
  .tool-card-enter {
    opacity: 0;
    transform: translateY(5px);
  }
  .tool-card-enter-active {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 300ms, transform 300ms;
  }
  
  .test-button {
    overflow: hidden;
    white-space: nowrap;
    width: 24px;
    transition: width 150ms ease-in-out;
  }
  
  .test-button:hover {
    width: 64px;
  }
  
  .test-button-text {
    opacity: 0;
    transition: opacity 75ms ease-in-out;
    transition-delay: 0ms;
  }
  
  .test-button:hover .test-button-text {
    opacity: 1;
    transition-delay: 75ms;
  }
`;

export function ToolSelector() {
  const { availableTools, payload, setPayload, useToolsEffect } = useChatContext();
  const [toolFilter, setToolFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [groupByCategory, setGroupByCategory] = useState(true);

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
  
  const testTool = (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling the tool selection
    alert(`Testing tool: ${toolId}`);
  };

  const enabledCount = payload.tools?.length || 0;

  // Get the appropriate icon for a tool, or fall back to the default Wrench icon
  const getToolIcon = (toolId: string) => {
    const IconComponent = TOOL_ICONS[toolId.toLowerCase()] || TOOL_ICONS.default;
    return <IconComponent className="h-5 w-5" />;
  };

  // Filter tools based on search input
  const filteredTools = availableTools.filter((tool: any) => 
    tool.id.toLowerCase().includes(toolFilter.toLowerCase()) || 
    (tool.description && tool.description.toLowerCase().includes(toolFilter.toLowerCase()))
  );

  // Group tools by category
  const toolsByCategory = filteredTools.reduce((acc: Record<string, any[]>, tool: any) => {
    const category = tool.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tool);
    return acc;
  }, {});

  useToolsEffect();

  // Tool card component to avoid duplication
  const ToolCard = ({ tool }: { tool: any }) => (
    <div 
      key={tool.id} 
      className={`p-3 rounded-lg border transition-all cursor-pointer relative ${
        payload.tools?.includes(tool.id) 
          ? 'bg-primary/10 border-primary/30 shadow-sm' 
          : 'bg-background hover:bg-accent/50 border-border'
      }`}
      onClick={() => toggleTool(tool.id)}
    >
      {/* Test Tool Button */}
      <button
        className="test-button absolute top-2 right-2 p-1 rounded-full bg-muted hover:bg-muted-foreground/20 text-muted-foreground transition-colors flex items-center"
        onClick={(e) => testTool(tool.id, e)}
        title="Test this tool"
      >
        <Play className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="test-button-text ml-1 text-xs">Test</span>
      </button>
      
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-full ${
          payload.tools?.includes(tool.id) 
            ? 'bg-primary/20 text-primary' 
            : 'bg-muted/60 text-muted-foreground'
        }`}>
          {getToolIcon(tool.id)}
        </div>
        
        <div className="flex-1 pr-8"> {/* Increased right padding to avoid overlap with expanded test button */}
          <h3 className="text-sm font-medium leading-none mb-1.5">
            {tool.id}
          </h3>
          
          {tool.description && tool.description.length > 100 ? (
            <div>
              <p className="text-xs text-muted-foreground">
                {expanded[tool.id] 
                  ? tool.description 
                  : `${tool.description.slice(0, 100)}...`}
              </p>
              <button 
                className="text-xs text-primary mt-1"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setExpanded({...expanded, [tool.id]: !expanded[tool.id]});
                }}
              >
                {expanded[tool.id] ? 'Show less' : 'Show more'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{tool.description}</p>
          )}
          
          <div className="flex items-center mt-1 space-x-1">
            {tool.category && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                {tool.category}
              </span>
            )}
            {tool.requiresInternet && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                Internet
              </span>
            )}
          </div>
          
          {tool.examples && tool.examples.length > 0 && (
            <div className="mt-2 bg-background rounded-md p-1.5">
              <p className="text-xs font-medium text-muted-foreground mb-1">Example:</p>
              <p className="text-xs italic text-foreground/70">{tool.examples[0]}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{animationStyles}</style>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="rounded-full bg-foreground/10 text-foreground-500 px-3 hover:bg-foreground/15 transition-colors"
            aria-label="Select tools for the AI to use"
          >
            <Wrench className="h-4 w-4" /> 
            {enabledCount > 0 ? ` (${enabledCount})` : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-4 mr-2 rounded-lg" align="start">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-lg leading-none">
              Tools ({enabledCount} enabled)
            </h4>
            <div className="flex space-x-2">
              {enabledCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  onClick={clearTools}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setGroupByCategory(!groupByCategory)}
                title={groupByCategory ? "Show as list" : "Group by category"}
              >
                {groupByCategory ? <Database className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Choose the tools that will help you be more present in this moment.
          </p>
          
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find a tool..."
                className="w-full pl-8 p-2 text-sm rounded-md bg-background border border-input"
                onChange={(e) => setToolFilter(e.target.value)}
                value={toolFilter}
              />
              {toolFilter && (
                <button 
                  className="absolute right-2 top-2.5"
                  onClick={() => setToolFilter("")}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          
          {enabledCount === 0 && (
            <div className="text-center py-6 px-4 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/30 my-4">
              <Leaf className="h-10 w-10 text-primary/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Select tools mindfully to enhance your experience.
                <br />Each tool brings unique abilities to your assistant.
              </p>
            </div>
          )}
          
          <ScrollArea className="h-[350px] pr-3">
            <div className="grid gap-4">
              {groupByCategory ? (
                Object.entries(toolsByCategory).map(([category, tools]) => (
                  <div key={category} className="mb-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">{category}</h3>
                    <div className="grid gap-2">
                      {(tools as any[]).map((tool: any) => (
                        <ToolCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                filteredTools.map((tool: any) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  );
} 