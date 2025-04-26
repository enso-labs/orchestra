import { Button } from "@/components/ui/button";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import { AlertCircle, RefreshCw, ServerIcon, CheckCircleIcon, PlusIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "@/components/ToolSelector/ToolSelector.module.css";
import { useToolContext } from "@/context/ToolContext";
import { useMemo } from "react";

// import 'prismjs/components/prism-json';
// import 'highlight.js/styles/github-dark-dimmed.min.css';

// Filter only MCP type servers
// const mcpServers = config.filter(server => server.type === "mcp");

/**
 * Template card component for the left column
 */
const ConfigCard = ({ item, onClick, isSelected }: { item: any, onClick?: () => void, isSelected: boolean }) => {
  return (
    <div 
      className={`border rounded-lg shadow-sm p-3 transition-all ${
        isSelected ? 'border-blue-500 ring-1 ring-blue-300' : 'hover:border-blue-300 hover:shadow'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center">
          <ServerIcon className="mr-2 text-blue-600" size={16} />
          <a 
            href={item.documentation_url || `/server/${item.slug}`} 
            className="font-medium hover:text-blue-600"
          >
            {item.name}
          </a>
        </div>
        <div 
          onClick={onClick}
          className="cursor-pointer transition-all"
        >
          {isSelected ? (
            <CheckCircleIcon className="text-blue-600 transition-opacity duration-200" size={16} />
          ) : (
            <PlusIcon className="text-gray-400 hover:text-blue-600 transition-colors duration-200" size={16} />
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">{item.description}</p>
      <div className="flex justify-between text-xs text-gray-300 mt-2">
        <span>Type: {item.type}</span>
        {item.public && <span>Public</span>}
      </div>
    </div>
  );
};

/**
 * Displays a tooltip and an editor for MCP configuration.
 */
function MCPInput({ isJsonValid }: { isJsonValid: boolean }) {
  const {
    hasSavedMCP,
    mcpCode,
    setMcpCode,
    mcpError,
    fetchMCPInfo,
    mcpServers,
    useMCPServersEffect,
  } = useToolContext();

  useMCPServersEffect();

  // Extract currently selected server slugs from mcpCode
  const selectedSlugs = useMemo(() => {
    try {
      const config = JSON.parse(mcpCode);
      return Object.keys(config);
    } catch (e) {
      return [];
    }
  }, [mcpCode]);

  const handleConfigSelect = (selectedConfig: any) => {
    try {
      // Parse the current mcpCode
      let currentConfig = {};
      try {
        currentConfig = JSON.parse(mcpCode);
      } catch (e) {
        // If current code isn't valid JSON, start with an empty object
        currentConfig = {};
      }

      // Check if this config is already selected
      if (typeof selectedConfig.slug === 'string' && currentConfig.hasOwnProperty(selectedConfig.slug)) {
        // If already exists, remove it
        const { [selectedConfig.slug as string]: removed, ...rest } = currentConfig as Record<string, any>;
        setMcpCode(Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : '{}');
      } else if (typeof selectedConfig.slug === 'string') { 
        // Add or update the selected config using the slug as the key
        const updatedConfig = {
          ...currentConfig,
          [selectedConfig.slug]: selectedConfig.config
        };
        // Update the mcpCode with the new configuration
        setMcpCode(JSON.stringify(updatedConfig, null, 2));
      }
    } catch (e) {
      console.error("Error updating MCP configuration:", e);
    }
  };

  return (
    <div className="space-y-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-sm text-muted-foreground mb-2 flex items-center">
              {hasSavedMCP 
                ? "Edit your MCP configuration in JSON format below." 
                : "Paste your MCP configuration in JSON format below."}
              <AlertCircle className="h-4 w-4 ml-1 text-muted-foreground/70" />
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">MCP configuration enables tools like shell commands, web scraping, and search functionalities.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column - Config Cards */}
        <div className="bg-muted/30 rounded-md p-3 h-[250px] md:h-[400px] overflow-auto">
          <h3 className="text-sm font-medium mb-3">MCP Templates</h3>
          <div className="space-y-3">
            {mcpServers.map((item: any) => (
              <ConfigCard 
                key={item.id} 
                item={item} 
                isSelected={selectedSlugs.includes(item.slug)}
                onClick={() => handleConfigSelect(item)}
              />
            ))}
          </div>
        </div>
        
        {/* Right Column - Current content */}
        <div className="bg-muted/30 rounded-md p-1 h-[250px] md:h-[400px] overflow-auto">
          <Editor
            value={mcpCode}
            onValueChange={code => setMcpCode(code)}
            highlight={code => highlight(code, languages.json, 'json')}
            padding={16}
            className={`${styles.editor} ${!isJsonValid ? 'border border-red-400 bg-red-50/10' : ''}`}
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 14,
              borderRadius: '0.375rem',
              minHeight: '100%',
            }}
          />
        </div>
      </div>
      
      {!isJsonValid && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>Invalid JSON format</AlertDescription>
        </Alert>
      )}
      
      {mcpError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>{mcpError}</AlertDescription>
        </Alert>
      )}
      
      {hasSavedMCP && (
        <Button 
          onClick={fetchMCPInfo}
          className="mt-2"
          size="sm"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Fetch MCP Information
        </Button>
      )}
    </div>
  );
}

export default MCPInput;