import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import { X, Save } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import styles from "./ToolSelector.module.css";
import 'prismjs/components/prism-json';
import 'highlight.js/styles/github-dark-dimmed.min.css';

interface MCPEditorProps {
  isLoadingMCPInfo: boolean;
  mcpInfoError: string | null;
  mcpInfo: any[] | null;
  mcpCode: string;
  setMcpCode: (code: string) => void;
  mcpError: string | null;
  hasSavedMCP: boolean;
  fetchMCPInfo: () => void;
  cancelAddingMCP: () => void;
  saveMCPConfig: () => void;
  handleRemoveMCPConfig: () => void;
}

export function MCPEditor({
  isLoadingMCPInfo,
  mcpInfoError,
  mcpInfo,
  mcpCode,
  setMcpCode,
  mcpError,
  hasSavedMCP,
  fetchMCPInfo,
  cancelAddingMCP,
  saveMCPConfig,
  handleRemoveMCPConfig
}: MCPEditorProps) {
  return (
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
  );
}

export default MCPEditor;
