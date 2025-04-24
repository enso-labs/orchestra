import { Button } from "@/components/ui/button";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "@/components/ToolSelector/ToolSelector.module.css";
import { useToolContext } from "@/context/ToolContext";

// import 'prismjs/components/prism-json';
// import 'highlight.js/styles/github-dark-dimmed.min.css';

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
  } = useToolContext();

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
  );
}

export default MCPInput;