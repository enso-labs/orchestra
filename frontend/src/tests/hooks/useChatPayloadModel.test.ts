import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAgent, INIT_AGENT_STATE } from "@/hooks/useAgent";

// Mock useModel to return null model for default conversations (server resolves)
const mockModel = vi.fn(() => null as string | null);
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
		mockModel.mockReturnValue(null);
		Object.defineProperty(window, "localStorage", {
			value: { getItem: vi.fn(() => null), setItem: vi.fn() },
			writable: true,
		});
	});

	it("agent.model stays empty when useModel returns null (server resolves)", async () => {
		const { result } = renderHook(() => useAgent());

		// useAgent sync effect guards on `if (model && ...)`, so agent.model stays ""
		expect(result.current.agent.model).toBe("");
	});

	it("agent.model stays empty even when useModel returns explicit model (model applied at submission)", async () => {
		mockModel.mockReturnValue("anthropic:claude-sonnet-4-20250514");
		const { result } = renderHook(() => useAgent());

		// agent.model no longer syncs from useModel — model is applied
		// at submission time in getMetadata() via agent.id lookup
		expect(result.current.agent.model).toBe("");
	});

	it("payload sends empty model for default chat (server resolves)", async () => {
		// model is null → agent.model stays ""
		const { result } = renderHook(() => useAgent());

		expect(result.current.agent.model).toBe("");

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

		// Empty string sent to server → server resolves from user settings
		expect(payload.model).toBe("");
	});

	it("initial agent state has empty model before sync", () => {
		expect(INIT_AGENT_STATE.agent.model).toBe("");
	});
});
