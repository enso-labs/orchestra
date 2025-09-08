import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";
import { useAgentContext } from "@/context/AgentContext";
import {
	optimizeSystemPrompt,
	alterSystemPrompt,
} from "@/lib/services/threadService";

export function useToolCreation() {
	const navigate = useNavigate();
	const { payload, setPayload } = useChatContext();
	const { agentDetails, setAgentDetails, isCreating, handleCreateAgent } =
		useAgentContext();

	const [activeTab, setActiveTab] = useState("settings");
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showPromptGenerator, setShowPromptGenerator] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);

	const handleGeneratePrompt = async (
		mode: "replace" | "alter",
		description: string,
	) => {
		if (!description.trim()) return;

		setIsGenerating(true);
		try {
			let result;
			if (mode === "replace") {
				result = await optimizeSystemPrompt({
					...payload,
					query: description,
				});
			} else {
				result = await alterSystemPrompt({
					...payload,
					query: description,
				});
			}

			if (result) {
				setPayload({ ...payload, system: result });
			}
			setShowPromptGenerator(false);
		} catch (error) {
			console.error("Failed to generate system prompt:", error);
		} finally {
			setIsGenerating(false);
		}
	};

	const processCreateAgent = async () => {
		try {
			await handleCreateAgent();
			navigate("/dashboard");
		} catch (error) {
			console.error("Failed to create agent:", error);
		}
	};

	const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
	const togglePromptGenerator = () =>
		setShowPromptGenerator(!showPromptGenerator);
	const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

	const updateSystemMessage = (message: string) => {
		setPayload({ ...payload, system: message });
	};

	return {
		// State
		payload,
		agentDetails,
		activeTab,
		isFullscreen,
		showPromptGenerator,
		isGenerating,
		isDrawerOpen,
		isCreating,

		// Actions
		setActiveTab,
		setAgentDetails,
		processCreateAgent,
		handleGeneratePrompt,
		toggleFullscreen,
		togglePromptGenerator,
		toggleDrawer,
		updateSystemMessage,
	};
}
