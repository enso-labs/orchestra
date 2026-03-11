import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import ThemedConversationShell from "./ThemedConversationShell";

const mockUseMediaQuery = vi.fn();

vi.mock("@/hooks/useMediaQuery", () => ({
	useMediaQuery: (query: string) => mockUseMediaQuery(query),
}));

vi.mock("@/components/lists/ChatMessages", () => ({
	default: ({ messages }: { messages: any[] }) => (
		<div data-testid="chat-messages">{messages.length}</div>
	),
}));

vi.mock("@/components/lists/ChatMessagesSkeleton", () => ({
	default: () => <div data-testid="chat-messages-skeleton" />,
}));

vi.mock("@/components/chat/ChatComposer", () => ({
	default: ({
		showAgentMenu,
		showSandboxStatus,
	}: {
		showAgentMenu?: boolean;
		showSandboxStatus?: boolean;
	}) => (
		<div
			data-testid="chat-composer"
			data-show-agent-menu={String(showAgentMenu)}
			data-show-sandbox-status={String(showSandboxStatus)}
		/>
	),
}));

vi.mock("@/components/panels/FileEditorPanel", () => ({
	default: () => <div data-testid="file-editor-panel" />,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props}>{children}</button>
	),
}));

vi.mock("@/components/ui/resizable", () => ({
	ResizablePanelGroup: ({ children }: { children: ReactNode }) => (
		<div data-testid="resizable-group">{children}</div>
	),
	ResizablePanel: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	ResizableHandle: () => <div data-testid="resizable-handle" />,
}));

vi.mock("@/components/ui/sheet", () => ({
	Sheet: ({ children }: { children: ReactNode }) => (
		<div data-testid="sheet">{children}</div>
	),
	SheetContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
}));

describe("ThemedConversationShell", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUseMediaQuery.mockReturnValue(false);
	});

	it("renders the branded empty state only when chat mode has no messages", () => {
		render(
			<ThemedConversationShell
				messages={[]}
				viewMode="chat"
				setViewMode={vi.fn()}
				emptyState={<div data-testid="empty-state" />}
			/>,
		);

		expect(screen.getByTestId("empty-state")).toBeInTheDocument();
		expect(
			screen.queryByTestId("chat-messages-skeleton"),
		).not.toBeInTheDocument();
		expect(screen.queryByTestId("chat-composer")).not.toBeInTheDocument();
	});

	it("prefers the loading skeleton over the empty state", () => {
		render(
			<ThemedConversationShell
				messages={[]}
				viewMode="chat"
				setViewMode={vi.fn()}
				isLoading={true}
				emptyState={<div data-testid="empty-state" />}
				showSandboxStatus={true}
			/>,
		);

		expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
		expect(screen.getByTestId("chat-messages-skeleton")).toBeInTheDocument();
		expect(screen.getByTestId("chat-composer")).toHaveAttribute(
			"data-show-sandbox-status",
			"true",
		);
	});

	it("prefers the error state over normal conversation content", () => {
		const onClick = vi.fn();

		render(
			<ThemedConversationShell
				messages={[{ id: "msg-1" }]}
				viewMode="chat"
				setViewMode={vi.fn()}
				error="Thread failed"
				errorAction={{ label: "Go to Chat", onClick }}
			/>,
		);

		expect(screen.getByTestId("themed-conversation-error")).toBeInTheDocument();
		expect(screen.getByText("Thread failed")).toBeInTheDocument();
		expect(screen.queryByTestId("chat-messages")).not.toBeInTheDocument();
		expect(screen.queryByTestId("chat-composer")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Go to Chat" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("keeps split view behavior in editor mode on desktop", () => {
		render(
			<ThemedConversationShell
				messages={[{ id: "msg-1" }]}
				viewMode="editor"
				setViewMode={vi.fn()}
				showAgentMenu={false}
			/>,
		);

		expect(screen.getByTestId("resizable-group")).toBeInTheDocument();
		expect(screen.getByTestId("file-editor-panel")).toBeInTheDocument();
		expect(screen.getByTestId("chat-messages")).toHaveTextContent("1");
		expect(screen.getByTestId("chat-composer")).toHaveAttribute(
			"data-show-agent-menu",
			"false",
		);
	});
});
