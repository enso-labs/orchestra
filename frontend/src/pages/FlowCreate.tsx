import { useState, useRef } from "react";
import ChatLayout from "@/layouts/ChatLayout";
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { X, Wand2 } from "lucide-react"
import { useNavigate } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";
import { optimizeSystemPrompt, alterSystemPrompt } from "@/services/threadService"
import { useAgentContext } from "@/context/AgentContext";
import FlowCreateMobile from "@/components/sections/flow/create/flow-create-mobile";
import FlowCreateDesktop from "@/components/sections/flow/create/flow-create-desktop";

export default function FlowCreate() {
  const navigate = useNavigate();
  const { payload, setPayload } = useChatContext();
  const { agentDetails, setAgentDetails, isCreating, handleCreateAgent } = useAgentContext();
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { messages } = useChatContext()
  const [activeTab, setActiveTab] = useState("settings") // Mobile uses "settings" or "preview", desktop uses "create" or "configure"
  const [conversationStarters, setConversationStarters] = useState([""])
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [promptDescription, setPromptDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddConversationStarter = () => {
    setConversationStarters([...conversationStarters, ""])
  }

  const handleRemoveConversationStarter = (index: number) => {
    const newStarters = [...conversationStarters]
    newStarters.splice(index, 1)
    setConversationStarters(newStarters)
  }
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
      
			{/* Mobile view with resizable panels */}
      <FlowCreateMobile 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        navigate={navigate}
        processCreateAgent={processCreateAgent}
        isCreating={isCreating}
        agentDetails={agentDetails}
        setAgentDetails={setAgentDetails}
        payload={payload}
        setPayload={setPayload}
        showPromptGenerator={showPromptGenerator}
        setShowPromptGenerator={setShowPromptGenerator}
				isFullscreen={isFullscreen}
				setIsFullscreen={setIsFullscreen}
				promptDescription={promptDescription}
				setPromptDescription={setPromptDescription}
				conversationStarters={conversationStarters}
				setConversationStarters={setConversationStarters}
				handleAddConversationStarter={handleAddConversationStarter}
				handleRemoveConversationStarter={handleRemoveConversationStarter}
				handleGeneratePrompt={handleGeneratePrompt}
				isGenerating={isGenerating}
				messages={messages}
				setIsDrawerOpen={setIsDrawerOpen}
				isDrawerOpen={isDrawerOpen}
				messagesEndRef={messagesEndRef}
      />

      {/* Desktop view with resizable panels */}
      <FlowCreateDesktop 
				processCreateAgent={processCreateAgent}
				loading={isCreating}
			/>
    </ChatLayout>
  );
} 