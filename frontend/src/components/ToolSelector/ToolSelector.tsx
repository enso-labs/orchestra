import { useChatContext } from "@/context/ChatContext";
import { useToolContext } from "@/context/ToolContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import DefaultToolContent from "./DefaultToolContent";
import TestToolContent from "./ToolContentTest";
import styles from "./ToolSelector.module.css";
import A2AEditor from "./A2AEditor";
import { useAppContext } from "@/context/AppContext";
import ModalButton from "./ModalButton";
  
export function ToolSelector() {
  const { 
    payload, 
    useToolsEffect,
    useMCPEffect,
    useA2AEffect,
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
    // MCP
    hasSavedMCP,
    startAddingMCP,
    useMCPInfoEffect,
    // A2A
    isAddingA2A,
    hasSavedA2A,
    startAddingA2A,
    useA2AInfoEffect,
  } = useToolContext();
  

  const { isMenuOpen, handleMenuOpen } = useAppContext();

  // Fetch MCP info when entering MCP editor mode
  useMCPInfoEffect();
  useA2AInfoEffect();

  // Load MCP from payload
  useLoadMCPFromPayloadEffect();

  const enabledCount = payload.tools?.length || 0;

  useA2AEffect();
  useMCPEffect();
  useToolsEffect();

  return (
    <>
      {/* Button to open the dialog */}
      <ModalButton enabledCount={enabledCount} setIsOpen={handleMenuOpen} />
      
      {/* Main dialog that replaces the popover */}
      <Dialog open={isMenuOpen} onOpenChange={handleMenuOpen}>
        <DialogContent className={`${styles.toolModalContent} sm:max-w-[600px] md:max-w-[800px] h-auto max-h-[90vh] overflow-hidden p-0`}>
          {isAddingA2A 
          ? <A2AEditor /> 
          : testingTool 
          ? (
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
