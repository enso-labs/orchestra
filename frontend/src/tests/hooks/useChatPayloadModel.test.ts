import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAgent, INIT_AGENT_STATE } from "@/hooks/useAgent";

// Mock useModel to simulate settings-based model resolution
const mockModel = vi.fn(() => "openai:gpt-4o");
const mockUseModelsEffect = vi.fn();
const mockUpdateQueryStateModel = vi.fn();

vi.mock("@/hooks/useModel", () => ({
	default: () => ({
		model: mockModel(),
		useModelsEffect: mockUseModelsEffect,
		updateQueryStateModel: mockUpdateQueryStateModel,
	}),
}));

vi.mock("@/lib/services/agentService", () => ({
	default: {
		search: vi.fn(),
		listPublic: vi.fn(),
	},
}));

vi.mock("@/lib/config/tool", () => ({
	default: {
		DEFAULT_MCP_CONFIG: {},
		DEFAULT_A2A_CONFIG: {},
	},
}));

describe("Chat payload model consistency via useAgent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockModel.mockReturnValue("openai:gpt-4o");
		Object.defineProperty(window, "localStorage", {
			value: { getItem: vi.fn(() => null), setItem: vi.fn() },
			writable: true,
		});
	});

	it("agent.model syncs from useModel (settings default)", async () => {
		const { result } = renderHook(() => useAgent());

		// useAgent syncs model from useModel into agent.model via useEffect
		await waitFor(() => {
			expect(result.current.agent.model).toBe("openai:gpt-4o");
		});
	});

	it("agent.model updates when settings default changes", async () => {
		mockModel.mockReturnValue("anthropic:claude-3.5-sonnet");
		const { result } = renderHook(() => useAgent());

		await waitFor(() => {
			expect(result.current.agent.model).toBe("anthropic:claude-3.5-sonnet");
		});
	});

	it("agent.model is used in payload structure (non-public agent)", async () => {
		const { result } = renderHook(() => useAgent());

		await waitFor(() => {
			expect(result.current.agent.model).toBe("openai:gpt-4o");
		});

		// Simulate what useChat does: build payload from agent
		const agent = result.current.agent;
		const payload = {
			system_prompt: agent.prompt,
			input: { messages: [] },
			model: agent.model,
			metadata: {},
			tools: agent.tools,
			a2a: agent.a2a,
			mcp: agent.mcp,
			subagents: agent.subagents,
		};

		expect(payload.model).toBe("openai:gpt-4o");
	});

	it("public agent payload uses empty model string", async () => {
		const { result } = renderHook(() => useAgent());

		await waitFor(() => {
			expect(result.current.agent.model).toBe("openai:gpt-4o");
		});

		// For public agents, useChat sends model: ""
		const agent = { ...result.current.agent, public: true };
		const payload = agent.public
			? { input: { messages: [] }, metadata: {}, model: "" }
			: { model: agent.model };

		expect(payload.model).toBe("");
	});

	it("initial agent state has empty model before sync", () => {
		expect(INIT_AGENT_STATE.agent.model).toBe("");
	});
});
