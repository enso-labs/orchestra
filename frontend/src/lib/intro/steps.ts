import { Step } from 'intro.js';

export const TOUR_IDS = {
  FIRST_TIME: 'first-time-user',
  CHAT_INTERFACE: 'chat-interface',
  AGENT_CREATION: 'agent-creation',
  SCHEDULES: 'schedules',
} as const;

export const firstTimeUserSteps: Step[] = [
  {
    title: 'Welcome to Ensō Orchestra',
    intro: 'Your intelligent AI orchestration platform powered by MCP & A2A protocols.',
    element: '[data-intro="welcome-logo"]',
  },
  {
    title: 'Start a Conversation',
    intro: 'Simply type your question or command here. Press Enter to send, or Shift+Enter for new lines.',
    element: '[data-intro="chat-input"]',
  },
  {
    title: 'Powerful Tools',
    intro: 'Access platform tools, integrations, and more from this menu.',
    element: '[data-intro="base-tool-menu"]',
  },
  {
    title: 'Customize Your Experience',
    intro: 'Switch between Day, Dusk, and Night modes to match your preference.',
    element: '[data-intro="color-mode-button"]',
  },
];

export const chatInterfaceSteps: Step[] = [
  {
    title: 'Your Conversation History',
    intro: 'Access previous chats and threads from the sidebar. All your conversations are saved.',
    element: '[data-intro="menu-button"]',
  },
  {
    title: 'Choose Your AI Model',
    intro: 'Select from different AI models based on your needs. Each model has unique capabilities.',
    element: '[data-intro="select-model"]',
  },
  {
    title: 'Work with Specialized Agents',
    intro: 'Switch between different AI agents, each configured for specific tasks.',
    element: '[data-intro="agent-menu"]',
  },
  {
    title: 'Rich Message Interactions',
    intro: 'Messages support markdown, code blocks, and more. Responses stream in real-time.',
    element: '[data-intro="chat-messages"]',
  },
];

export const agentCreationSteps: Step[] = [
  {
    title: 'Configure Your Agent',
    intro: 'Give your agent a name, description, and select the AI model it will use.',
    element: '[data-intro="basic-config"]',
  },
  {
    title: 'Define Agent Behavior',
    intro: 'The system message shapes how your agent thinks and responds. Click the expand icon for a full editor.',
    element: '[data-intro="system-message"]',
  },
  {
    title: 'Equip Your Agent with Tools',
    intro: 'Add platform tools, MCP servers, or A2A agents to extend your agent\'s capabilities.',
    element: '[data-intro="tools-section"]',
  },
  {
    title: 'Collaborate with SubAgents',
    intro: 'Create powerful workflows by adding other agents as subagents. They\'ll work together seamlessly.',
    element: '[data-intro="subagents-section"]',
  },
  {
    title: 'Save Your Configuration',
    intro: 'When you\'re done, save your agent. You can always come back and edit it later.',
    element: '[data-intro="save-button"]',
  },
];

export const schedulesSteps: Step[] = [
  {
    title: 'Automate Your Workflows',
    intro: 'Schedule agents to run automatically at specified times using cron expressions.',
    element: '[data-intro="schedules-heading"]',
  },
  {
    title: 'Create New Schedule',
    intro: 'Click here to create a new automated schedule for any of your agents.',
    element: '[data-intro="create-schedule"]',
  },
  {
    title: 'Monitor Your Schedules',
    intro: 'Track active, upcoming, and overdue schedules at a glance.',
    element: '[data-intro="stats-cards"]',
  },
];
