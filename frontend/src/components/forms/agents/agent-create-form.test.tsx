import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
	useNavigate: () => vi.fn(),
	useParams: () => ({}),
}));

// Mock AgentContext
const mockAgentContext = {
	agent: {
		id: undefined,
		name: "",
		description: "",
		model: "gpt-4",
		tools: [],
		subagents: [],
		mcp: {},
		a2a: {},
		public: false,
	},
	agents: [],
	setAgent: vi.fn(),
	toggleSubagent: vi.fn(),
	isAgentSelected: vi.fn().mockReturnValue(false),
	updateQueryStateModel: vi.fn(),
};

vi.mock("@/context/AgentContext", () => ({
	useAgentContext: () => mockAgentContext,
}));

// Mock ChatContext
vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => ({
		toBackendFormat: vi.fn().mockReturnValue({}),
	}),
}));

// Mock MonacoEditor
vi.mock("@/components/inputs/MonacoEditor", () => ({
	default: () => <div data-testid="monaco-editor" />,
}));

// Mock SelectModel
vi.mock("@/components/lists/SelectModel", () => ({
	default: ({ onModelSelected }: { onModelSelected: () => void }) => (
		<select data-testid="select-model" />
	),
}));

// Mock ToolSelectionModal
vi.mock("@/components/modals/ToolSelectionModal", () => ({
	ToolSelectionModal: () => null,
}));

// Mock PromptSelectionModal
vi.mock("@/components/modals/PromptSelectionModal", () => ({
	PromptSelectionModal: () => null,
}));

import { AgentCreateForm } from "./agent-create-form";

describe("AgentCreateForm — AGENTS.md guidance (US-005)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset to default new-agent state
		mockAgentContext.agent = {
			id: undefined,
			name: "",
			description: "",
			model: "gpt-4",
			tools: [],
			subagents: [],
			mcp: {},
			a2a: {},
			public: false,
		};
	});

	it("does NOT render a tab with text 'Instructions'", () => {
		render(<AgentCreateForm />);

		// There should be no tab trigger with text "Instructions"
		const instructionsTab = screen.queryByRole("tab", {
			name: /instructions/i,
		});
		expect(instructionsTab).not.toBeInTheDocument();
	});

	it("does NOT render a tab with text 'System Prompt'", () => {
		render(<AgentCreateForm />);

		// There should be no tab trigger with text "System Prompt"
		const systemPromptTab = screen.queryByRole("tab", {
			name: /system prompt/i,
		});
		expect(systemPromptTab).not.toBeInTheDocument();
	});

	it("renders a guidance note containing 'AGENTS.md'", () => {
		render(<AgentCreateForm />);

		// The form should display a guidance note mentioning AGENTS.md
		const guidanceNote = screen.getByText(/AGENTS\.md/);
		expect(guidanceNote).toBeInTheDocument();
	});

	it("renders text about creating AGENTS.md in the file panel", () => {
		render(<AgentCreateForm />);

		// The guidance note should reference the file panel for creating AGENTS.md
		const filePanelText = screen.getByText(/file panel/i);
		expect(filePanelText).toBeInTheDocument();
	});
});
