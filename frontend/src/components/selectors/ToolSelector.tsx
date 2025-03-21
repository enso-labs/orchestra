import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Wrench, X, Compass, Brain, Feather, Cloud, Database, 
  Search, BookOpen, Globe, Infinity, Leaf, Play,
  PlusCircle, Save
} from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { useState, useEffect } from "react";
import apiClient from "@/lib/utils/apiClient";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
// import 'prismjs/themes/prism.css';
import 'highlight.js/styles/github-dark-dimmed.min.css';

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
    availableTools, 
    payload, 
    setPayload, 
    useToolsEffect,
    setIsToolCallInProgress,
    setCurrentToolCall,
    useMCPEffect
  } = useChatContext();

  const defaultMCP = {
    "python": {
      "transport": "sse",
      "url": "https://mcp.enso.sh/sse"
    }
  }
  
  const [toolFilter, setToolFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [testingTool, setTestingTool] = useState<any>(null);
  const [testFormValues, setTestFormValues] = useState<Record<string, any>>({});
  const [isAddingMCP, setIsAddingMCP] = useState(false);
  const [mcpCode, setMcpCode] = useState(JSON.stringify(defaultMCP, null, 2));
  const [mcpError, setMcpError] = useState('');
  const [hasSavedMCP, setHasSavedMCP] = useState(false);

  // Load MCP from payload
  useEffect(() => {
    if (payload.mcp) {
      setMcpCode(JSON.stringify(payload.mcp, null, 2));
      setHasSavedMCP(true);
    }
  }, [payload.mcp]);

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
  
  const testTool = (tool: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling the tool selection
    
    // Initialize form values with defaults
    const initialValues: Record<string, any> = {};
    if (tool.args) {
      Object.entries(tool.args).forEach(([key, value]: [string, any]) => {
        // If the arg has a default value, use it
        if (value && value.default !== undefined) {
          initialValues[key] = value.default;
        } else {
          // Otherwise initialize with appropriate empty value based on type
          const type = value?.type || 'string';
          initialValues[key] = type === 'integer' || type === 'number' ? 0 : 
                               type === 'boolean' ? false : 
                               type === 'array' ? [] : '';
        }
      });
    }
    
    setTestFormValues(initialValues);
    setTestingTool(tool);
  };

  const handleTestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!testingTool) return;
    
    // Create a tool call message for the Action Log
    const toolCallData = {
      id: `test-${Date.now()}`,
      role: 'tool',
      name: testingTool.id,
      content: JSON.stringify(testFormValues, null, 2),
      status: 'running',
      type: 'tool_call',
      timestamp: new Date().toISOString()
    };

    // Update the UI to show that a tool call is in progress
    setCurrentToolCall(toolCallData);
    setIsToolCallInProgress(true);
    
    // Close the form
    setTestingTool(null);
    
    try {
      // Call the API with the tool ID and form values
      const response = await apiClient.post(`/tools/${testingTool.id}/invoke`, {
        args: testFormValues
      });
      
      // Update the tool call with the result
      const updatedToolCall = {
        ...toolCallData,
        status: 'success',
        output: typeof response.data.output === 'object' 
          ? JSON.stringify(response.data.output, null, 2) 
          : response.data.output
      };
      
      // Send the updated tool call to the context
      setCurrentToolCall(updatedToolCall);
      
    } catch (error: any) {
      // Update the tool call with the error
      const updatedToolCall = {
        ...toolCallData,
        status: 'error',
        output: error.response?.data?.error || 'An error occurred',
        error: error.response?.data?.error,
        traceback: error.response?.data?.traceback
      };
      
      // Send the updated tool call to the context
      setCurrentToolCall(updatedToolCall);
    }
  };

  const handleInputChange = (key: string, value: any) => {
    setTestFormValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const cancelTesting = () => {
    setTestingTool(null);
  };

  const startAddingMCP = () => {
    setIsAddingMCP(true);
  };

  const cancelAddingMCP = () => {
    setIsAddingMCP(false);
    setMcpError('');
    
    // Reset the editor to the current payload MCP if one exists
    if (payload.mcp) {
      setMcpCode(JSON.stringify(payload.mcp, null, 2));
    } else {
      setMcpCode(JSON.stringify(defaultMCP, null, 2));
    }
  };

  const saveMCPConfig = () => {
    try {
      // Validate JSON
      const parsedConfig = JSON.parse(mcpCode);
      
      // Update payload
      setPayload((prev: { mcp: any; }) => ({
        ...prev,
        mcp: parsedConfig
      }));
      
      // Update state to show config is saved
      setHasSavedMCP(true);
      
      // Clear any previous errors
      setMcpError('');
      
    } catch (e) {
      setMcpError('Invalid JSON format. Please check your configuration.');
    }
  };
  
  const removeMCPConfig = () => {
    // Remove from payload
    setPayload((prev: { mcp: any; }) => {
      const { mcp, ...rest } = prev;
      return rest;
    });
    
    // Update state
    setHasSavedMCP(false);
    
    // Reset to default
    setMcpCode(JSON.stringify(defaultMCP, null, 2));
    
    // If removing while in edit mode, we'll keep it open
    if (!isAddingMCP) {
      setIsAddingMCP(false);
    }
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
    const category = tool.tags && tool.tags.length > 0 ? tool.tags[0] : 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tool);
    return acc;
  }, {});

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
        onClick={(e) => testTool(tool, e)}
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
            {tool.tags && tool.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
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