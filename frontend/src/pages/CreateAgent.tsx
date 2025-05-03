import { useState, useRef } from "react";
import ChatLayout from "../layouts/ChatLayout";
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, X, Maximize2, Wand2 } from "lucide-react"
import { useNavigate } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";
import ChatMessages from "@/components/lists/ChatMessages";
import ChatInput from "@/components/inputs/ChatInput";
import { ChatNav } from "@/components/nav/ChatNav";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { optimizeSystemPrompt, alterSystemPrompt } from "@/services/threadService"
import { useAgentContext } from "@/context/AgentContext";


export default function CreateAgent() {
  const navigate = useNavigate();
  const { payload, setPayload } = useChatContext();
  const { agentDetails, setAgentDetails, isCreating, handleCreateAgent } = useAgentContext();
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { messages } = useChatContext()
  const [activeTab, setActiveTab] = useState("settings") // Mobile uses "settings" or "preview", desktop uses "create" or "configure"
  // const [conversationStarters, setConversationStarters] = useState([""])
  // const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [promptDescription, setPromptDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // const handleAddConversationStarter = () => {
  //   setConversationStarters([...conversationStarters, ""])
  // }

  // const handleRemoveConversationStarter = (index: number) => {
  //   const newStarters = [...conversationStarters]
  //   newStarters.splice(index, 1)
  //   setConversationStarters(newStarters)
  // }
  const handleGeneratePrompt = async (mode: 'replace' | 'alter') => {
    if (!promptDescription.trim()) return;
    
    setIsGenerating(true);
    try {
      let result;
      if (mode === 'replace') {
        result = await optimizeSystemPrompt({
          ...payload,
          query: promptDescription
        });
      } else {
        result = await alterSystemPrompt({
          ...payload,
          query: promptDescription
        });
      }
      
      if (result) {
        setPayload({ ...payload, system: result });
      }
      setShowPromptGenerator(false);
      setPromptDescription("");
    } catch (error) {
      console.error("Failed to generate system prompt:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  const processCreateAgent = async () => {
    try {
      await handleCreateAgent();
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to create agent:", error);
    }
  }

  return (
    <ChatLayout>
      {/* Fullscreen textarea overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Edit System Message</h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowPromptGenerator(!showPromptGenerator)}
                title="Generate system prompt"
              >
                <Wand2 className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsFullscreen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {showPromptGenerator && (
            <div className="bg-background border rounded-md shadow-md p-4 mb-4">
              <div className="flex flex-col gap-3">
                <div className="text-sm font-medium">Describe what you want the AI to do</div>
                <input
                  type="text"
                  className="w-full p-2 border rounded text-sm"
                  placeholder="e.g., Act as a JavaScript expert"
                  value={promptDescription}
                  onChange={(e) => setPromptDescription(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowPromptGenerator(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleGeneratePrompt('alter')}
                    disabled={isGenerating || !promptDescription.trim()}
                  >
                    {isGenerating ? "Processing..." : "Alter"}
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleGeneratePrompt('replace')}
                    disabled={isGenerating || !promptDescription.trim()}
                  >
                    {isGenerating ? "Processing..." : "Replace"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Textarea
            placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
            className="flex-1 resize-none h-full"
            value={payload.system}
            onChange={(e) => {
              setPayload({ ...payload, system: e.target.value })
            }}
            autoFocus={!showPromptGenerator}
          />
        </div>
      )}
      
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
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate("/")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-medium">New Enso</h1>
              <p className="text-xs text-muted-foreground">• Draft</p>
            </div>
            <div className="ml-auto">
              <Button 
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" 
                onClick={processCreateAgent}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>

          {/* Mobile content (no tabs, just the form) */}
          <div className="space-y-6">
            <div>
              <label className="block mb-2 text-sm font-medium">Name</label>
              <Input placeholder="Name your Enso" className="bg-secondary/50 border-border" value={agentDetails.name} onChange={(e) => setAgentDetails({ ...agentDetails, name: e.target.value })} />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Description</label>
              <Textarea
                placeholder="Add a short description about what this Enso does"
                className="bg-secondary/50 border-border resize-none"
                rows={2}
                value={agentDetails.description}
                onChange={(e) => setAgentDetails({ ...agentDetails, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Model</label>
              <Input placeholder="Name your Enso" className="bg-secondary/50 border-border" disabled value={payload.model} />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">System Message</label>
              <div className="relative">
                <Textarea
                  placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
                  className="bg-secondary/50 border-border resize-none"
                  rows={10}
                  value={payload.system}
                  onChange={(e) => {
                    setPayload({ ...payload, system: e.target.value })
                  }}
                />
                <div className="flex justify-end mt-1 gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5"
                    onClick={() => setShowPromptGenerator(!showPromptGenerator)}
                    title="Generate system prompt"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {showPromptGenerator && (
                <div className="mt-2 bg-background border rounded-md shadow-md p-3">
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium">Describe what you want the AI to do</div>
                    <input
                      type="text"
                      className="w-full p-2 border rounded text-sm"
                      placeholder="e.g., Act as a JavaScript expert"
                      value={promptDescription}
                      onChange={(e) => setPromptDescription(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowPromptGenerator(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleGeneratePrompt('alter')}
                        disabled={isGenerating || !promptDescription.trim()}
                      >
                        {isGenerating ? "Processing..." : "Alter"}
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handleGeneratePrompt('replace')}
                        disabled={isGenerating || !promptDescription.trim()}
                      >
                        {isGenerating ? "Processing..." : "Replace"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* <div>
              <label className="block mb-2 text-sm font-medium">Conversation starters</label>
              {conversationStarters.map((starter, index) => (
                <div key={index} className="flex mb-2 w-full">
                  <Input
                    value={starter}
                    onChange={(e) => {
                      const newStarters = [...conversationStarters]
                      newStarters[index] = e.target.value
                      setConversationStarters(newStarters)
                    }}
                    className="bg-secondary/50 border-border flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveConversationStarter(index)}
                    className="ml-1 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {conversationStarters.length < 4 && (
                <Button
                  variant="outline"
                  onClick={handleAddConversationStarter}
                  className="w-full mt-2 border-dashed border-border bg-transparent"
                >
                  Add starter
                </Button>
              )}
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">Knowledge</label>
              <p className="text-sm text-muted-foreground">
                If you upload files under Knowledge, conversations with your Enso may include file contents. Files can
                be downloaded when Code Interpreter is enabled
              </p>
            </div> */}
          </div>
        </div>

        {/* Right panel - Preview (Mobile) */}
        <div className={`${
          activeTab === "preview" ? "block" : "hidden"
        } flex-1 flex flex-col h-[50vh]`}>
          <ChatNav
            onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)}
          />

          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            <div className="space-y-4 max-w-4xl mx-auto pb-4">
              <ChatMessages messages={messages} />
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          <div className="sticky bottom-0 bg-background border-border">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col gap-2 p-4 pb-25">
                <ChatInput />
              </div>
            </div>
          </div>
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
              <div className="flex items-center mb-6">
                <Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate("/")}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-medium">New Enso</h1>
                  <p className="text-xs text-muted-foreground">• Draft</p>
                </div>
                <div className="ml-auto">
                  <Button 
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" 
                    onClick={processCreateAgent}
                    disabled={isCreating}
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </Button>
                </div>
              </div>

              {/* Desktop Tabs - Only visible on desktop */}
              <div className="hidden md:block">
                <Tabs defaultValue="create" className="w-full">
                  {/* <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary rounded-md">
                    <TabsTrigger value="create">Create</TabsTrigger>
                    <TabsTrigger value="configure">Configure</TabsTrigger>
                  </TabsList> */}

                  <TabsContent value="create" className="space-y-6">
                    {/* <div className="flex justify-center mb-8">
                      <div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <span className="text-2xl">+</span>
                        </Button>
                      </div>
                    </div> */}

                    <div className="space-y-4 max-w-full">
                      <div>
                        <label className="block mb-2 text-sm font-medium">Name</label>
                        <Input placeholder="Name your Enso" className="bg-secondary/50 border-border" value={agentDetails.name} onChange={(e) => setAgentDetails({ ...agentDetails, name: e.target.value })} />
                      </div>

                      <div>
                        <label className="block mb-2 text-sm font-medium">Description</label>
                        <Textarea
                          placeholder="Add a short description about what this Enso does"
                          className="bg-secondary/50 border-border resize-none"
                          rows={2}
                          value={agentDetails.description}
                          onChange={(e) => setAgentDetails({ ...agentDetails, description: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block mb-2 text-sm font-medium">Model</label>
                        <Input placeholder="Name your Enso" className="bg-secondary/50 border-border" disabled value={payload.model} />
                      </div>

                      <div>
                        <label className="block mb-2 text-sm font-medium">System Message</label>
                        <div className="relative">
                          <Textarea
                            placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
                            className="bg-secondary/50 border-border resize-none"
                            rows={10}
                            value={payload.system}
                            onChange={(e) => {
                              setPayload({ ...payload, system: e.target.value })
                            }}
                          />
                          <div className="flex justify-end mt-1 gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5"
                              onClick={() => setShowPromptGenerator(!showPromptGenerator)}
                              title="Generate system prompt"
                            >
                              <Wand2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5"
                              onClick={() => setIsFullscreen(true)}
                            >
                              <Maximize2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {showPromptGenerator && (
                          <div className="mt-2 bg-background border rounded-md shadow-md p-3">
                            <div className="flex flex-col gap-2">
                              <div className="text-xs font-medium">Describe what you want the AI to do</div>
                              <input
                                type="text"
                                className="w-full p-2 border rounded text-sm"
                                placeholder="e.g., Act as a JavaScript expert"
                                value={promptDescription}
                                onChange={(e) => setPromptDescription(e.target.value)}
                              />
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setShowPromptGenerator(false)}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleGeneratePrompt('alter')}
                                  disabled={isGenerating || !promptDescription.trim()}
                                >
                                  {isGenerating ? "Processing..." : "Alter"}
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleGeneratePrompt('replace')}
                                  disabled={isGenerating || !promptDescription.trim()}
                                >
                                  {isGenerating ? "Processing..." : "Replace"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* <div>
                        <label className="block mb-2 text-sm font-medium">Conversation starters</label>
                        {conversationStarters.map((starter, index) => (
                          <div key={index} className="flex mb-2 w-full">
                            <Input
                              value={starter}
                              onChange={(e) => {
                                const newStarters = [...conversationStarters]
                                newStarters[index] = e.target.value
                                setConversationStarters(newStarters)
                              }}
                              className="bg-secondary/50 border-border flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveConversationStarter(index)}
                              className="ml-1 flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {conversationStarters.length < 4 && (
                          <Button
                            variant="outline"
                            onClick={handleAddConversationStarter}
                            className="w-full mt-2 border-dashed border-border bg-transparent"
                          >
                            Add starter
                          </Button>
                        )}
                      </div>

                      <div>
                        <label className="block mb-2 text-sm font-medium">Knowledge</label>
                        <p className="text-sm text-muted-foreground">
                          If you upload files under Knowledge, conversations with your Enso may include file contents. Files can
                          be downloaded when Code Interpreter is enabled
                        </p>
                      </div> */}
                    </div>
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
            <div className="flex flex-col h-full">
              <ChatNav onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)} />
              
              <div className="flex-1 overflow-y-auto p-3 min-h-0">
                <div className="space-y-4 max-w-4xl mx-auto pb-4">
                  <ChatMessages messages={messages} />
                  <div ref={messagesEndRef} />
                </div>
              </div>
              
              <div className="sticky bottom-0 bg-background border-border">
                <div className="max-w-4xl mx-auto">
                  <div className="flex flex-col gap-2 p-4 pb-25">
                    <ChatInput />
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </ChatLayout>
  );
} 