import { Button } from "@/components/ui/button";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import { X, Save, AlertCircle, RefreshCw } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "@/components/ToolSelector/ToolSelector.module.css";
import { useState, useEffect } from "react";
import { useToolContext } from "@/context/ToolContext";

// MCP Editor Components
import MCPInfo from "./mcp-info";
import MCPInfoError from "./mcp-info-error";
import MCPInfoLoad from "./mcp-info-load";
import MCPHeader from "./mcp-header";
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
      ? <MCPInfoLoad /> : mcpInfoError 
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