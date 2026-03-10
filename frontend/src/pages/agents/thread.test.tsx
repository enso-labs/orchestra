import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import AgentThreadPage from "./thread";

const mockUseChatContext = vi.fn();
const mockUseAgentContext = vi.fn();
const mockUseModel = vi.fn();
const mockSetSearchParams = vi.fn();
const mockSetActiveTab = vi.fn();

vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => mockUseChatContext(),
}));

vi.mock("@/context/AgentContext", () => ({
	useAgentContext: () => mockUseAgentContext(),
}));

vi.mock("@/hooks/useModel", () => ({
	default: () => mockUseModel(),
}));

vi.mock("nuqs", () => ({
	useQueryState: () => [null, mockSetActiveTab],
}));

vi.mock("react-router-dom", async () => {
	const actual =
		await vi.importActual<typeof import("react-router-dom")>(
			"react-router-dom",
		);
	return {
		...actual,
		useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
	};
});

vi.mock("@/layouts/chat-layout-v2", () => ({
	default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/nav/ChatNav", () => ({
	ChatNav: () => <div data-testid="chat-nav" />,
}));

vi.mock("@/components/ui/sidebar", () => ({
	SidebarTrigger: () => <div data-testid="sidebar-trigger" />,
}));

vi.mock("@/components/ui/tabs", () => ({
	Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TabsTrigger: ({ children }: { children: ReactNode }) => (
		<button>{children}</button>
	),
}));

vi.mock("@/components/ui/scroll-area", () => ({
	ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/pages/chat/ChatPanel", () => ({
	default: () => <div data-testid="chat-panel" />,
}));

vi.mock("@/components/forms/agents/agent-create-form", () => ({
	AgentCreateForm: () => <div data-testid="agent-form" />,
}));

vi.mock("@/hooks/useAgent", () => ({
	INIT_AGENT_STATE: {
		agent: {
			id: "",
			name: "",
			files: {},
		},
	},
}));

function renderPage() {
	return render(
		<MemoryRouter initialEntries={["/assistant/agent-1/thread/thread-1"]}>
			<Routes>
				<Route
					path="/assistant/:agentId/thread/:threadId"
					element={<AgentThreadPage />}
				/>
			</Routes>
		</MemoryRouter>,
	);
}

describe("AgentThreadPage", () => {
	const clearBackendSyncFiles = vi.fn();
	const clearThreadScopedFiles = vi.fn();
	const fromBackendFormat = vi.fn();
	const runWithPersistentSyncSuspended = vi.fn((callback: () => void) =>
		callback(),
	);

	beforeEach(() => {
		vi.clearAllMocks();

		mockUseAgentContext.mockReturnValue({
			agent: {
				id: "agent-1",
				name: "Agent",
				files: { "/assistant.md": "config" },
				mcp: {},
				a2a: {},
			},
			setAgent: vi.fn(),
			useEffectGetAgent: vi.fn(),
			useEffectGetAgents: vi.fn(),
		});

		mockUseModel.mockReturnValue({
			setModel: vi.fn(),
			useModelsEffect: vi.fn(),
		});

		mockUseChatContext.mockReturnValue({
			useListThreadsEffect: vi.fn(),
			messages: [],
			useEffectUpdateAssistantId: vi.fn(),
			useLoadThreadEffect: vi.fn(),
			setCheckpoints: vi.fn(),
			setMessages: vi.fn(),
			setMetadata: vi.fn(),
			setFilesMap: vi.fn(),
			setTodos: vi.fn(),
			fromBackendFormat,
			clearBackendSyncFiles,
			clearThreadScopedFiles,
			runWithPersistentSyncSuspended,
		});
	});

	it("loads assistant files through backend sync without clearing baseline state", () => {
		renderPage();

		expect(runWithPersistentSyncSuspended).toHaveBeenCalledTimes(1);
		expect(fromBackendFormat).toHaveBeenCalledWith({
			"/assistant.md": "config",
		});
		expect(clearBackendSyncFiles).not.toHaveBeenCalled();
		expect(clearThreadScopedFiles).not.toHaveBeenCalled();
	});

	it("clears transient assistant and thread layers on unmount", () => {
		const { unmount } = renderPage();

		unmount();

		expect(clearBackendSyncFiles).toHaveBeenCalledTimes(1);
		expect(clearThreadScopedFiles).toHaveBeenCalledTimes(1);
	});
});
