import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useChatContext } from "@/context/ChatContext";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

// Modular components
import {
  ToolCreateHeader,
  FullscreenEditor,
  PreviewPanel
} from "./components";

// Custom hook
  import { useToolCreation } from "./hooks/useToolCreation";
import { useToolContext } from "@/context/ToolContext";
import FileEditor from "@/components/FileEditor";
import FullScreenLayout from "@/layouts/FullScreenLayout";

export default function ToolCreate() {
  const { messages } = useChatContext();
  const { useSpecEffect } = useToolContext();
  const {
    // State
    payload,
    activeTab,
    isFullscreen,
    showPromptGenerator,
    isGenerating,
    isCreating,
    
    // Actions
    setActiveTab,
    processCreateAgent,
    handleGeneratePrompt,
    toggleFullscreen,
    togglePromptGenerator,
    toggleDrawer,
    updateSystemMessage,
  } = useToolCreation();

  useSpecEffect();

  return (
    <FullScreenLayout>
      {/* Fullscreen textarea overlay */}
      <FullscreenEditor
        isVisible={isFullscreen}
        onClose={toggleFullscreen}
        value={payload.system}
        onChange={updateSystemMessage}
        showPromptGenerator={showPromptGenerator}
        onTogglePromptGenerator={togglePromptGenerator}
        onGeneratePrompt={handleGeneratePrompt}
        isGenerating={isGenerating}
      />
      
      <div className="flex flex-col md:hidden h-screen w-full bg-background text-foreground overflow-hidden">
        {/* Mobile Tabs - Only visible on mobile */}
        <div className="w-full p-4 pb-0">
          <Tabs value={activeTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary rounded-md">
              <TabsTrigger
                value="settings"
                onClick={() => setActiveTab("settings")}
              >
                Settings
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Left panel - Settings (Mobile) */}
        <div className={`${
          activeTab === "settings" ? "block" : "hidden"
        } flex-1 p-4 border-b border-border overflow-y-auto`}>
          <ToolCreateHeader 
            onCreateAgent={processCreateAgent}
            isCreating={isCreating}
          />

          {/* Mobile content (no tabs, just the form) */}
          <div className="space-y-6">
            <FileEditor />
          </div>
        </div>

        {/* Right panel - Preview (Mobile) */}
        <div className={`${
          activeTab === "preview" ? "block" : "hidden"
        } flex-1 flex flex-col h-[50vh]`}>
          <PreviewPanel
            messages={messages}
            onMenuClick={toggleDrawer}
          />
        </div>
      </div>

      {/* Desktop view with resizable panels */}
      <div className="hidden md:block h-screen w-full">
        <ResizablePanelGroup
          direction="horizontal"
          className="w-full h-full bg-background text-foreground"
        >
          {/* Left panel - Settings */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="p-4 h-full overflow-y-auto">
              <ToolCreateHeader 
                onCreateAgent={processCreateAgent}
                isCreating={isCreating}
              />

              {/* Desktop Tabs - Only visible on desktop */}
              <div className="hidden md:block">
                <Tabs defaultValue="create" className="w-full">
                  <TabsContent value="create" className="space-y-6">
                    <FileEditor />
                  </TabsContent>

                  <TabsContent value="configure">
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      Configuration options would appear here
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* Right panel - Preview */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <PreviewPanel
              messages={messages}
              onMenuClick={toggleDrawer}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </FullScreenLayout>
  );
} 