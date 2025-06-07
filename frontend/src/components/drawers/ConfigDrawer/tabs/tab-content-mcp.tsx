import { Button } from "@/components/ui/button";
import { X, Save, AlertCircle, Loader2, CheckCircle, RefreshCw, ServerIcon, CheckCircleIcon, PlusIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import { useState, useEffect, useMemo } from "react";
import { useToolContext } from "@/context/ToolContext";
import { useChatContext } from "@/context/ChatContext";

/**
 * Template card component for MCP configurations
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
            target="_blank"
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

function TabContentMCP() {
  const {
    mcpInfo,
    mcpCode,
    setMcpCode,
    hasSavedMCP,
    isLoadingMCPInfo,
    mcpInfoError,
    fetchMCPInfo,
    mcpError,
    saveMCPConfig,
    handleRemoveMCPConfig,
    mcpServers,
    useMCPInfoEffect,
    useMCPServersEffect
  } = useToolContext();
  
  const { useToolsEffect } = useChatContext();
  const [isJsonValid, setIsJsonValid] = useState(true);
  
  // Use effects from context
  useToolsEffect();
  useMCPInfoEffect();
  useMCPServersEffect();
  
  useEffect(() => {
    try {
      if (mcpCode) {
        JSON.parse(mcpCode);
        setIsJsonValid(true);
      }
    } catch (e) {
      setIsJsonValid(false);
    }
  }, [mcpCode]);
  
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
    <div className="p-4">
      <div className="mb-4 pb-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center">
            {hasSavedMCP ? (
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            ) : null}
            {hasSavedMCP ? "MCP Configuration" : "Add MCP Configuration"}
          </h2>
        </div>
      </div>
      
      {isLoadingMCPInfo ? (
        <div className="text-center py-8 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading MCP information...</p>
        </div>
      ) : mcpInfoError ? (
        <div className="space-y-4">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{mcpInfoError}</AlertDescription>
          </Alert>
          
          <div className="bg-muted/30 rounded-md p-1">
            <Editor
              value={mcpCode}
              onValueChange={code => setMcpCode(code)}
              highlight={code => highlight(code, languages.json, 'json')}
              padding={16}
              className={`${!isJsonValid ? 'border border-red-400 bg-red-50/10' : ''}`}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 12,
                borderRadius: '0.375rem',
                minHeight: '200px',
              }}
            />
          </div>
          
          <Button 
            onClick={fetchMCPInfo}
            className="mt-4"
            size="sm"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : mcpInfo ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center">
            Available MCP tools:
          </h3>
          
          <ScrollArea className="h-[calc(100vh-300px)] pr-3 border rounded-md bg-muted/30 p-4">
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
      ) : (
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
            <div className="bg-muted/30 rounded-md p-3 h-[250px] md:h-[350px] overflow-auto">
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
            <div className="bg-muted/30 rounded-md p-1 h-[250px] md:h-[350px] overflow-auto">
              <Editor
                value={mcpCode}
                onValueChange={code => setMcpCode(code)}
                highlight={code => highlight(code, languages.json, 'json')}
                padding={16}
                className={`${!isJsonValid ? 'border border-red-400 bg-red-50/10' : ''}`}
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 12,
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
      )}
      
      <div className="mt-6 pt-4 border-t space-x-2 flex justify-end">
        <Button 
          type="button" 
          variant={hasSavedMCP ? "destructive" : "default"} 
          onClick={hasSavedMCP ? handleRemoveMCPConfig : saveMCPConfig}
          disabled={((!isJsonValid || !mcpCode || Object.keys(JSON.parse(mcpCode || '{}')).length === 0) && !hasSavedMCP)}
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
      </div>
    </div>
  );
}

export default TabContentMCP;