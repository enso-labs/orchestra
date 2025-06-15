import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { optimizeSystemPrompt, alterSystemPrompt } from "@/lib/services/threadService";
import { useChatContext } from '@/context/ChatContext';
import { useAgentContext } from '@/context/AgentContext';

export default function useAgentHook() {
	const navigate = useNavigate();
	const { handleCreateAgent } = useAgentContext();
	const { payload, setPayload } = useChatContext();
	const [activeTab, setActiveTab] = useState("settings");
	const [promptDescription, setPromptDescription] = useState("");
	const [showPromptGenerator, setShowPromptGenerator] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [conversationStarters, setConversationStarters] = useState([""])
  const [isMaximized, setIsMaximized] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);

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

	const handleAddConversationStarter = () => {
    setConversationStarters([...conversationStarters, ""])
  }

  const handleRemoveConversationStarter = (index: number) => {
    const newStarters = [...conversationStarters]
    newStarters.splice(index, 1)
    setConversationStarters(newStarters)
  }

	return {
		activeTab,
		setActiveTab,
		isFullscreen,
		setIsFullscreen,
		promptDescription,
		setPromptDescription,
		showPromptGenerator,
		setShowPromptGenerator,
		isGenerating,
		setIsGenerating,
		handleGeneratePrompt,
		processCreateAgent,
		conversationStarters,
		setConversationStarters,
		isMaximized,
		setIsMaximized,
		handleAddConversationStarter,
		handleRemoveConversationStarter
	}
}