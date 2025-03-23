import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Wrench, X, Database, 
  Search, BookOpen, Play,
  PlusCircle, Save
} from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import 'highlight.js/styles/github-dark-dimmed.min.css';
import { useToolContext } from "@/context/ToolContext";
import ToolCard from "@/components/cards/ToolCard";

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
  
  .editor {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    min-height: 200px;
    border: 1px solid hsl(var(--border));
    border-radius: 6px;
    background-color: hsl(var(--background));
  }
  
  .editor:focus-within {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
`;

export function ToolSelector() {
  const { 
    payload, 
    useToolsEffect,
    useMCPEffect
  } = useChatContext();
  const {
    toolsByCategory,
    filteredTools,
    clearTools,
    handleInputChange,
    cancelTesting,
    startAddingMCP,
    cancelAddingMCP,
    saveMCPConfig,
    removeMCPConfig,
    testingTool,
    handleTestFormSubmit,
    testFormValues,
    isAddingMCP,
    mcpCode,
    setMcpCode,
    mcpError,
    hasSavedMCP,
    toolFilter,
    setToolFilter,
    groupByCategory,
    setGroupByCategory,
    useLoadMCPFromPayloadEffect,
  } = useToolContext();

  // Load MCP from payload
  useLoadMCPFromPayloadEffect();

  const enabledCount = payload.tools?.length || 0;

  // Render form field based on argument type
  const renderFormField = (key: string, argDef: any) => {
    const type = argDef?.type || 'string';
    const title = argDef?.title || key;
    const description = argDef?.description || '';
    
    switch (type) {
      case 'string':
        return (
          <div key={key} className="mb-3">
            <Label htmlFor={key} className="text-sm font-medium">
              {title}
              {description && (
                <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
              )}
            </Label>
            <Input
              id={key}
              value={testFormValues[key] || ''}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className="mt-1"
              placeholder={argDef?.placeholder || ''}
            />
          </div>
        );
        
      case 'integer':
      case 'number':
        return (
          <div key={key} className="mb-3">
            <Label htmlFor={key} className="text-sm font-medium">
              {title}
              {description && (
                <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
              )}
            </Label>
            <Input
              id={key}
              type="number"
              value={testFormValues[key] || 0}
              onChange={(e) => handleInputChange(key, Number(e.target.value))}
              className="mt-1"
            />
          </div>
        );
        
      case 'boolean':
        return (
          <div key={key} className="mb-3 flex items-center">
            <input
              id={key}
              type="checkbox"
              checked={!!testFormValues[key]}
              onChange={(e) => handleInputChange(key, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor={key} className="ml-2 text-sm font-medium">
              {title}
              {description && (
                <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
              )}
            </Label>
          </div>
        );
        
      // For more complex types like arrays, you might need more sophisticated controls
      default:
        return (
          <div key={key} className="mb-3">
            <Label htmlFor={key} className="text-sm font-medium">
              {title} ({type})
              {description && (
                <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
              )}
            </Label>
            <Input
              id={key}
              value={typeof testFormValues[key] === 'object' 
                ? JSON.stringify(testFormValues[key]) 
                : testFormValues[key] || ''}
              onChange={(e) => {
                try {
                  // Try to parse as JSON if it's supposed to be an object/array
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(key, parsed);
                } catch {
                  // If parsing fails, store as string
                  handleInputChange(key, e.target.value);
                }
              }}
              className="mt-1"
            />
          </div>
        );
    }
  };

  useMCPEffect();
  useToolsEffect();

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
          {isAddingMCP ? (
            // MCP Config Editor View
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-lg">
                  {hasSavedMCP ? "Edit MCP Configuration" : "Add MCP Configuration"}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={cancelAddingMCP}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                {hasSavedMCP 
                  ? "Edit your MCP configuration in JSON format below." 
                  : "Paste your MCP configuration in JSON format below."}
              </p>
              
              <div className="mb-4">
                <Editor
                  value={mcpCode}
                  onValueChange={code => setMcpCode(code)}
                  highlight={code => highlight(code, languages.json, 'json')}
                  padding={10}
                  className="editor"
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 14,
                  }}
                />
                
                {mcpError && (
                  <div className="text-sm text-red-500 mt-2">
                    {mcpError}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={cancelAddingMCP}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant={hasSavedMCP ? "destructive" : "default"} 
                  onClick={hasSavedMCP ? removeMCPConfig : saveMCPConfig}
                >
                  {hasSavedMCP ? (
                    <>
                      <X className="h-4 w-4 mr-1" />
                      Remove Configuration
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : testingTool ? (
            // Test Tool Form
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-lg">
                  Test Tool: {testingTool.id}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={cancelTesting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                {testingTool.description}
              </p>
              
              <form onSubmit={handleTestFormSubmit}>
                <div className="space-y-2 mb-4">
                  {testingTool.args && Object.entries(testingTool.args).map(([key, argDef]: [string, any]) => 
                    renderFormField(key, argDef)
                  )}
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={cancelTesting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Play className="h-4 w-4 mr-1" />
                    Run Test
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            // Normal Tool Selection View
            <>
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
                    onClick={startAddingMCP}
                    title={hasSavedMCP ? "Edit or remove MCP configuration" : "Add MCP configuration"}
                  >
                    <PlusCircle className="h-4 w-4" />
                    {hasSavedMCP && <span className="ml-1 w-2 h-2 bg-green-500 rounded-full absolute top-0 right-0"></span>}
                  </Button>
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
              
              {/* {enabledCount === 0 && (
                <div className="text-center py-6 px-4 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/30 my-4">
                  <Leaf className="h-10 w-10 text-primary/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Select tools mindfully to enhance your experience.
                    <br />Each tool brings unique abilities to your assistant.
                  </p>
                </div>
              )} */}
              
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
            </>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
} 