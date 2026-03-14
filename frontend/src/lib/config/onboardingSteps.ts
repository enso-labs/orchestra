import type { Step } from "react-joyride";

export const onboardingSteps: Step[] = [
	{
		target: '[data-tour="sidebar"]',
		content:
			"Welcome! This is your sidebar — navigate between Assistants, Memories, Projects, and Threads.",
		placement: "right",
		disableBeacon: true,
	},
	{
		target: '[data-tour="assistants-link"]',
		content: "Browse and manage your AI assistants here.",
		placement: "right",
	},
	{
		target: '[data-tour="memories-link"]',
		content: "Store persistent context that your assistants can reference.",
		placement: "right",
	},
	{
		target: '[data-tour="projects-section"]',
		content: "Organize your work into projects with sources.",
		placement: "right",
	},
	{
		target: '[data-tour="threads-section"]',
		content: "Your conversation history lives here.",
		placement: "right",
	},
	{
		target: '[data-tour="chat-input"]',
		content: "Type your message here to start chatting.",
		placement: "top",
	},
	{
		target: '[data-tour="sandbox-selector"]',
		content: "Choose where your code runs — local, cloud, or no sandbox.",
		placement: "top",
	},
	{
		target: '[data-tour="files-toggle-button"]',
		content:
			"Open the file editor to view and edit files alongside your conversation.",
		placement: "top",
	},
	{
		target: '[data-tour="tools-menu-button"]',
		content:
			"Attach images, toggle web search, and configure tools for your assistant.",
		placement: "top",
	},
	{
		target: '[data-tour="agent-selector-button"]',
		content:
			"Select a saved assistant to use its custom instructions and tool configuration.",
		placement: "top",
	},
	{
		target: '[data-tour="model-selector"]',
		content: "Switch between AI models to balance speed, cost, and capability.",
		placement: "top",
	},
	{
		target: '[data-tour="chat-submit-button"]',
		content:
			"Send your message, or use the microphone for voice input when the field is empty.",
		placement: "top",
	},
	{
		target: '[data-tour="chat-nav-actions"]',
		content:
			"Save assistants, share threads, start new conversations, and toggle themes.",
		placement: "bottom",
	},
	{
		target: '[data-tour="settings-popover"]',
		content: "Access your settings and preferences.",
		placement: "top",
	},
	{
		target: '[data-tour="help-button"]',
		content: "Click here anytime to replay this tour.",
		placement: "bottom",
	},
];
