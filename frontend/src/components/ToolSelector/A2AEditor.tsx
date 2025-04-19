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

export function A2AEditor() {
  const {
    a2aInfo,
    a2aCode,
    setA2ACode,
    hasSavedA2A,
    cancelAddingA2A,
    isLoadingA2AInfo,
    a2aInfoError,
    fetchA2AInfo,
    a2aError,
    removeA2AConfig,
    saveA2AConfig,
  } = useToolContext();
  const [isJsonValid, setIsJsonValid] = useState(true);
  
  useEffect(() => {
    try {
      if (a2aCode) {
        JSON.parse(a2aCode);
        setIsJsonValid(true);
      }
    } catch (e) {
      setIsJsonValid(false);
    }
  }, [a2aCode]);

  return (
    <div className="p-6">
      <DialogHeader className="mb-6 pb-4 border-b">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-xl font-semibold flex items-center">
            {hasSavedA2A ? (
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            ) : null}
            {hasSavedA2A ? "A2A Configuration" : "Add A2A Configuration"}
          </DialogTitle>
          <DialogClose onClick={cancelAddingA2A} className="h-7 w-7 p-0 hover:bg-muted rounded-full" />
        </div>
      </DialogHeader>
      
      {isLoadingA2AInfo ? (
        <div className="text-center py-8 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading A2A information...</p>
        </div>
      ) : a2aInfoError ? (
        <div className="space-y-4">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{a2aInfoError}</AlertDescription>
          </Alert>
          
          <div className="bg-muted/30 rounded-md p-1">
            <Editor
              value={a2aCode}
              onValueChange={code => setA2ACode(code)}
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
            onClick={fetchA2AInfo}
            className="mt-4"
            size="sm"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : a2aInfo ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center">
            Available A2A tools:
          </h3>
          
          <ScrollArea className="h-[350px] pr-3 border rounded-md bg-muted/30 p-4">
            <div className="space-y-3">
              {a2aInfo.map((agent: any, index: number) => (
                <div key={index} className="border rounded-md p-4 bg-card hover:shadow-sm transition-shadow">
                  <a href={agent.documentationUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                    <h4 className="font-medium text-primary flex items-center justify-between">
                      {agent.name}
                      <div className="flex items-center gap-2">
                        {agent.version && <Badge variant="secondary" className="text-xs">v{agent.version}</Badge>}
                        <Badge variant="outline" className="text-xs">agent</Badge>
                      </div>
                    </h4>
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
                  
                  {agent.skills && agent.skills.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-dashed">
                      <p className="text-xs font-medium mb-1">Skills:</p>
                      <div className="space-y-3">
                        {agent.skills.map((skill: any) => (
                          <div key={skill.id} className="ml-2">
                            <p className="text-xs font-medium text-primary">{skill.name}</p>
                            <p className="text-xs text-muted-foreground">{skill.description}</p>
                            
                            {skill.examples && skill.examples.length > 0 && (
                              <div className="mt-1">
                                <p className="text-[10px] italic text-muted-foreground">Examples:</p>
                                <ul className="list-disc pl-4 text-xs text-muted-foreground">
                                  {skill.examples.map((example: string, i: number) => (
                                    <li key={i} className="text-[10px]">{example}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {skill.tags && skill.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {skill.tags.map((tag: string) => (
                                  <Badge key={tag} variant="secondary" className="text-[10px]">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
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
                  {hasSavedA2A 
                    ? "Edit your A2A configuration in JSON format below." 
                    : "Paste your A2A configuration in JSON format below."}
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
              value={a2aCode}
              onValueChange={code => setA2ACode(code)}
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
          
          {a2aError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertDescription>{a2aError}</AlertDescription>
            </Alert>
          )}
          
          {hasSavedA2A && (
            <Button 
              onClick={fetchA2AInfo}
              className="mt-2"
              size="sm"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Fetch A2A Information
            </Button>
          )}
        </div>
      )}
      
      <DialogFooter className="mt-6 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={cancelAddingA2A}
        >
          Cancel
        </Button>
        <Button 
          type="button" 
          variant={hasSavedA2A ? "destructive" : "default"} 
          onClick={hasSavedA2A ? removeA2AConfig : saveA2AConfig}
          disabled={!isJsonValid && !hasSavedA2A}
        >
          {hasSavedA2A ? (
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

export default A2AEditor;