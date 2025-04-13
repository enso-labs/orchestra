import { useChatContext } from "@/context/ChatContext";
import { useToolContext } from "@/context/ToolContext";
import { useState, useCallback, useEffect } from 'react';
import apiClient from "@/lib/utils/apiClient";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import DefaultToolContent from "./DefaultToolContent";
import ModalButton from "./ModalButton";
import TestToolContent from "./ToolContentTest";
import MCPEditor from "./MCPEditor";
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
    cancelTesting,
    startAddingMCP,
    cancelAddingMCP,
    saveMCPConfig,
    removeMCPConfig,
    testingTool,
    handleTestFormSubmit,
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
            <MCPEditor
              isLoadingMCPInfo={isLoadingMCPInfo}
              mcpInfoError={mcpInfoError}
              mcpInfo={mcpInfo}
              mcpCode={mcpCode}
              setMcpCode={setMcpCode}
              mcpError={mcpError}
              hasSavedMCP={hasSavedMCP}
              fetchMCPInfo={fetchMCPInfo}
              cancelAddingMCP={cancelAddingMCP}
              saveMCPConfig={saveMCPConfig}
              handleRemoveMCPConfig={handleRemoveMCPConfig}
            />
          ) : testingTool ? (
            <TestToolContent 
              testingTool={testingTool} 
              cancelTesting={cancelTesting} 
              handleTestFormSubmit={handleTestFormSubmit}
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
