import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  X,
  Save
} from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import 'highlight.js/styles/github-dark-dimmed.min.css';
import { useToolContext } from "@/context/ToolContext";
import { useState, useCallback, useEffect } from 'react';
import apiClient from "@/lib/utils/apiClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import DefaultToolContent from "./DefaultToolContent";
import ModalButton from "./ModalButton";
import TestToolContent from "./ToolContentTest";
import styles from "./ToolSelector.module.css";

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

  // Add state for modal visibility
  const [isOpen, setIsOpen] = useState(false);

  // Add state for MCP info
  const [mcpInfo, setMcpInfo] = useState<any[] | null>(null);
  const [isLoadingMCPInfo, setIsLoadingMCPInfo] = useState(false);
  const [mcpInfoError, setMcpInfoError] = useState<string | null>(null);

  // Function to fetch MCP info
  const fetchMCPInfo = useCallback(async () => {
    if (!mcpCode) return;
    
    try {
      setIsLoadingMCPInfo(true);
      setMcpInfoError(null);
      
      let mcpConfig;
      try {
        mcpConfig = JSON.parse(mcpCode);
      } catch (e) {
        setMcpInfoError("Invalid JSON configuration");
        return;
      }
      
      try {
        const response = await apiClient.post('/tools/mcp/info', { 
          mcp: mcpConfig 
        });
        
        setMcpInfo(response.data.mcp);
      } catch (apiError: any) {
        throw new Error(`Error fetching MCP info: ${apiError.message}`);
      }
    } catch (error: unknown) {
      setMcpInfoError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoadingMCPInfo(false);
    }
  }, [mcpCode]);

  // Reset mcpInfo when MCP configuration is removed
  const handleRemoveMCPConfig = () => {
    setMcpInfo(null);
    removeMCPConfig();
  };

  // Fetch MCP info when entering MCP editor mode
  useEffect(() => {
    if (isAddingMCP && hasSavedMCP) {
      fetchMCPInfo();
    }
  }, [isAddingMCP, hasSavedMCP, fetchMCPInfo]);

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
      {/* Button to open the dialog */}
      <ModalButton enabledCount={enabledCount} setIsOpen={setIsOpen} />
      
      {/* Main dialog that replaces the popover */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className={`${styles.toolModalContent} sm:max-w-[600px] md:max-w-[800px] h-auto max-h-[90vh] overflow-hidden p-0`}>
          {isAddingMCP ? (
            // MCP Config Editor View with API data display
            <div className="p-6">
              <DialogHeader className="mb-4">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg font-medium">
                    {hasSavedMCP ? "MCP Configuration" : "Add MCP Configuration"}
                  </DialogTitle>
                  <DialogClose onClick={cancelAddingMCP} className="h-7 w-7 p-0" />
                </div>
              </DialogHeader>
              
              {isLoadingMCPInfo ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Loading MCP information...</p>
                </div>
              ) : mcpInfoError ? (
                <div>
                  <p className="text-sm text-red-500 mb-4">{mcpInfoError}</p>
                  <Editor
                    value={mcpCode}
                    onValueChange={code => setMcpCode(code)}
                    highlight={code => highlight(code, languages.json, 'json')}
                    padding={10}
                    className={styles.editor}
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 14,
                    }}
                  />
                  <Button 
                    onClick={fetchMCPInfo}
                    className="mt-4"
                    size="sm"
                  >
                    Retry
                  </Button>
                </div>
              ) : mcpInfo ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Available MCP tools:
                  </p>
                  <ScrollArea className="h-[350px] pr-3">
                    <div className="space-y-2">
                      {mcpInfo.map((tool, index) => (
                        <div key={index} className="border rounded-md p-3">
                          <h4 className="font-medium">{tool.name}</h4>
                          <p className="text-sm text-muted-foreground">{tool.description}</p>
                          {tool.args && Object.keys(tool.args).length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium">Arguments:</p>
                              <ul className="text-xs text-muted-foreground">
                                {Object.entries(tool.args).map(([key, arg]) => (
                                  <li key={key}>{key}: {(arg as any).type || 'string'}</li>
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
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {hasSavedMCP 
                      ? "Edit your MCP configuration in JSON format below." 
                      : "Paste your MCP configuration in JSON format below."}
                  </p>
                  
                  <Editor
                    value={mcpCode}
                    onValueChange={code => setMcpCode(code)}
                    highlight={code => highlight(code, languages.json, 'json')}
                    padding={10}
                    className={styles.editor}
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
                  
                  {hasSavedMCP && (
                    <Button 
                      onClick={fetchMCPInfo}
                      className="mt-4"
                      size="sm"
                    >
                      Fetch MCP Information
                    </Button>
                  )}
                </div>
              )}
              
              <DialogFooter className="mt-6">
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
                  onClick={hasSavedMCP ? handleRemoveMCPConfig : saveMCPConfig}
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
              </DialogFooter>
            </div>
          ) : testingTool ? (
            <TestToolContent 
              testingTool={testingTool} 
              cancelTesting={cancelTesting} 
              handleTestFormSubmit={handleTestFormSubmit} 
              renderFormField={renderFormField} 
            />
          ) : (
            <DefaultToolContent 
              enabledCount={enabledCount} 
              clearTools={clearTools} 
              startAddingMCP={startAddingMCP} 
              hasSavedMCP={hasSavedMCP} 
              groupByCategory={groupByCategory} 
              setGroupByCategory={setGroupByCategory}
              toolFilter={toolFilter}
              setToolFilter={setToolFilter}
              toolsByCategory={toolsByCategory}
              filteredTools={filteredTools}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 

export default ToolSelector;
