import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Polyfill ResizeObserver for jsdom (needed by Radix UI Switch)
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

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
const mockCreateFile = vi.fn();
vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => ({
		toBackendFormat: vi.fn().mockReturnValue({}),
		createFile: mockCreateFile,
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

// Helper to set mock agent with legacy instructions for US-007 tests
function setMockAgent(overrides: Record<string, unknown>) {
	mockAgentContext.agent = {
		id: "existing-agent-123",
		name: "Test Agent",
		description: "A test agent",
		model: "gpt-4",
		tools: [],
		subagents: [],
		mcp: {},
		a2a: {},
		public: false,
		...overrides,
	};
}

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

describe("AgentCreateForm — Legacy instructions migration card (US-007)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows a read-only legacy card when agent has instructions but no AGENTS.md in files", () => {
		setMockAgent({
			instructions: "You are a helpful coding assistant.",
			files: {},
		});
		render(<AgentCreateForm />);

		// Should display the legacy instructions content in a read-only card
		expect(
			screen.getByText(/You are a helpful coding assistant/),
		).toBeInTheDocument();
		// The card should be visually distinct (look for legacy/migration indicator)
		expect(screen.getByText(/legacy instructions/i)).toBeInTheDocument();
	});

	it("includes a 'Migrate to AGENTS.md' button in the legacy card", () => {
		setMockAgent({
			instructions: "You are a helpful coding assistant.",
			files: {},
		});
		render(<AgentCreateForm />);

		const migrateButton = screen.getByRole("button", {
			name: /migrate to agents\.md/i,
		});
		expect(migrateButton).toBeInTheDocument();
	});

	it("does NOT show the legacy card when agent has AGENTS.md in files", () => {
		setMockAgent({
			instructions: "You are a helpful coding assistant.",
			files: { "AGENTS.md": "# My Agent Instructions" },
		});
		render(<AgentCreateForm />);

		// Legacy card should not appear when AGENTS.md already exists
		expect(
			screen.queryByText(/legacy instructions/i),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /migrate to agents\.md/i }),
		).not.toBeInTheDocument();
	});

	it("does NOT show the legacy card when agent has no instructions and no system_prompt", () => {
		setMockAgent({
			instructions: undefined,
			system_prompt: undefined,
			files: {},
		});
		render(<AgentCreateForm />);

		// No legacy card when there are no legacy instructions to show
		expect(
			screen.queryByText(/legacy instructions/i),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /migrate to agents\.md/i }),
		).not.toBeInTheDocument();
	});
});
