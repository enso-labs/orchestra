import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mockUseChatContext = vi.fn();
vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => mockUseChatContext(),
}));

const mockUseAgentContext = vi.fn();
vi.mock("@/context/AgentContext", () => ({
	useAgentContext: () => mockUseAgentContext(),
}));

const mockForkThreadCheckpoint = vi.fn();
vi.mock("@/lib/services/threadService", () => ({
	forkThreadCheckpoint: (...args: any[]) => mockForkThreadCheckpoint(...args),
}));

vi.mock("@/components/buttons/ColorModeButton", () => ({
	ColorModeButton: () => <button data-testid="color-mode-button" />,
}));
vi.mock("../buttons/NewThreadButton", () => ({
	default: () => <button data-testid="new-thread-button" />,
}));
vi.mock("../buttons/thread-share-button", () => ({
	default: () => <button data-testid="share-button" />,
}));
vi.mock("@/components/dialogs/SaveAsAssistantDialog", () => ({
	SaveAsAssistantDialog: () => null,
}));
vi.mock("@/components/ui/sheet", () => ({
	Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SheetContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { ChatNav } from "./ChatNav";

const defaultContext = {
	metadata: { thread_id: "thread-123" },
	checkpoints: [
		{
			checkpoint_id: "cp-1",
			created_at: "2026-03-08T12:00:00Z",
			source: "input",
			message_preview: "First turn",
			model: "openai:gpt-4.1-mini",
			has_files: false,
			has_todos: false,
			has_interrupts: false,
			is_restorable: true,
			is_head: true,
		},
	],
	checkpointsLoading: false,
	checkpointsError: null,
	threadViewMode: "latest" as const,
	previewCheckpoint: null,
	activeCheckpointId: "cp-1",
	currentThread: { head_checkpoint_id: "cp-1" },
};

describe("ChatNav", () => {
	beforeEach(() => {
		mockUseChatContext.mockReturnValue(defaultContext);
		mockUseAgentContext.mockReturnValue({
			agent: {
				model: "",
				prompt: "",
				tools: [],
				subagents: [],
				mcp: {},
				a2a: {},
				files: [],
			},
			handleGetAgents: vi.fn(),
		});
		mockForkThreadCheckpoint.mockResolvedValue({
			thread_id: "fork-123",
			head_checkpoint_id: "fork-cp-1",
			source_thread_id: "thread-123",
			source_checkpoint_id: "cp-0",
		});
	});

	it("renders core nav elements and a history button", () => {
		render(
			<MemoryRouter>
				<ChatNav />
			</MemoryRouter>,
		);

		expect(screen.getByTestId("color-mode-button")).toBeInTheDocument();
		expect(screen.getByTestId("new-thread-button")).toBeInTheDocument();
		expect(screen.getByTestId("share-button")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /history/i }),
		).toBeInTheDocument();
	});

	it("shows the preview banner when a checkpoint preview is active", () => {
		mockUseChatContext.mockReturnValue({
			...defaultContext,
			threadViewMode: "checkpoint_preview",
			previewCheckpoint: {
				checkpoint_id: "cp-0",
				created_at: "2026-03-08T11:00:00Z",
				is_restorable: true,
			},
			activeCheckpointId: "cp-0",
		});

		render(
			<MemoryRouter>
				<ChatNav />
			</MemoryRouter>,
		);

		expect(screen.getByText(/Viewing checkpoint from/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Restore as New Thread/i }),
		).toBeInTheDocument();
	});

	it("renders checkpoint history entries when the history sheet opens", () => {
		render(
			<MemoryRouter>
				<ChatNav />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: /history/i }));

		expect(screen.getByText("Checkpoint History")).toBeInTheDocument();
		expect(screen.getByText("First turn")).toBeInTheDocument();
	});
});
