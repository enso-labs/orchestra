import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import { X, Save, AlertCircle, Loader2, CheckCircle, RefreshCw } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./ToolSelector.module.css";
import 'prismjs/components/prism-json';
import 'highlight.js/styles/github-dark-dimmed.min.css';
import { useState, useEffect } from "react";
import { useToolContext } from "@/context/ToolContext";


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

/**
 * Displays an error message and an editor for MCP configuration.
 */
function MCPInfoError() {
  const {
    mcpInfoError,
    fetchMCPInfo,
    mcpCode,
    setMcpCode,
    isJsonValid,
  } = useToolContext();

  return (
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
          className={`${styles.editor} ${!isJsonValid ? 'border border-red-400 bg-red-50/10' : ''}`}
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 14,
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
  );
}

/**
 * Displays a loading indicator for MCP information.
 */
function LoadingMCPInfo() {
  return (
    <div className="text-center py-8 space-y-3">
      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      <p className="text-sm text-muted-foreground">Loading MCP information...</p>
    </div>
  );
}

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

/**
 * Displays an MCP editor with a header, editor, and footer.
 */
export function MCPEditor() {
  const {
    mcpInfo,
    isLoadingMCPInfo,
    mcpInfoError,
    fetchMCPInfo,
    cancelAddingMCP,
    saveMCPConfig,
    handleRemoveMCPConfig,
    mcpCode,
    setMcpCode,
    mcpError,
    hasSavedMCP,
  } = useToolContext();
  const [isJsonValid, setIsJsonValid] = useState(true);
  
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

  return (
    <div className="p-6">
      <MCPHeader />
      {isLoadingMCPInfo 
      ? <LoadingMCPInfo /> : mcpInfoError 
      ? <MCPInfoError /> : mcpInfo 
      ? <MCPInfo /> : (
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
          
          <div className="bg-muted/30 rounded-md p-1">
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
                minHeight: '200px',
              }}
            />
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
      
      <DialogFooter className="mt-6 pt-4 border-t">
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
          disabled={!isJsonValid && !hasSavedMCP}
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
      </DialogFooter>
    </div>
  );
}

export default MCPEditor;