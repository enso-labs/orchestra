import { useChatContext } from "@/context/ChatContext";
import { useToolContext } from "@/context/ToolContext";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
    testingTool,
    handleTestFormSubmit,
    toolFilter,
    setToolFilter,
    groupByCategory,
    setGroupByCategory,
    useLoadMCPFromPayloadEffect,
    startAddingA2A,
    hasSavedA2A,
    // MCP
    isAddingMCP,
    hasSavedMCP,
    startAddingMCP,
    useMCPInfoEffect,
  } = useToolContext();
  

  // Add state for modal visibility
  const [isOpen, setIsOpen] = useState(false);

  // Fetch MCP info when entering MCP editor mode
  useMCPInfoEffect();

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
          {isAddingMCP ? <MCPEditor /> : testingTool ? (
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
              startAddingA2A={startAddingA2A}
              hasSavedA2A={hasSavedA2A}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 

export default ToolSelector;
