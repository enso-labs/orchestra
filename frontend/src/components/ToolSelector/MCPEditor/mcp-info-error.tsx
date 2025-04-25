import { useToolContext } from "@/context/ToolContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import styles from "@/components/ToolSelector/ToolSelector.module.css";

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

export default MCPInfoError;