import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import ChatPanel from "./ChatPanel";

const mockUseChatContext = vi.fn();
const mockUseAppContext = vi.fn();

vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => mockUseChatContext(),
}));

vi.mock("@/context/AppContext", () => ({
	useAppContext: () => mockUseAppContext(),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
	useMediaQuery: () => false,
}));

vi.mock("@/layouts/ChatLayout", () => ({
	default: ({ children }: { children: ReactNode }) => (
		<div data-testid="chat-layout">{children}</div>
	),
}));

vi.mock("@/components/sections/agent-section", () => ({
	default: () => <div data-testid="agent-section" />,
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

vi.mock("@/components/lists/ChatMessages", () => ({
	default: ({ messages }: { messages: any[] }) => (
		<div data-testid="chat-messages">{messages.length}</div>
	),
}));

vi.mock("@/components/ui/resizable", () => ({
	ResizablePanelGroup: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	ResizablePanel: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	ResizableHandle: () => <div />,
}));

vi.mock("@/components/ui/sheet", () => ({
	Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SheetContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
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

describe("ChatPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockUseAppContext.mockReturnValue({
			appVersion: "test-version",
		});

		mockUseChatContext.mockReturnValue({
			messages: [{ id: "msg-1", content: "Hello" }],
			viewMode: "chat",
			setViewMode: vi.fn(),
		});
	});

	it("renders the composer without sandbox status by default", () => {
		render(<ChatPanel chatNav={<div data-testid="chat-nav" />} />);

		expect(screen.getByTestId("chat-composer")).toHaveAttribute(
			"data-show-agent-menu",
			"true",
		);
		expect(screen.getByTestId("chat-composer")).toHaveAttribute(
			"data-show-sandbox-status",
			"false",
		);
	});

	it("renders the composer with sandbox status when enabled", () => {
		render(
			<ChatPanel
				chatNav={<div data-testid="chat-nav" />}
				showSandboxStatus={true}
			/>,
		);

		expect(screen.getByTestId("chat-composer")).toHaveAttribute(
			"data-show-sandbox-status",
			"true",
		);
	});

	it("passes showAgentMenu through to the composer", () => {
		render(
			<ChatPanel
				chatNav={<div data-testid="chat-nav" />}
				showAgentMenu={false}
			/>,
		);

		expect(screen.getByTestId("chat-composer")).toHaveAttribute(
			"data-show-agent-menu",
			"false",
		);
	});

	it("renders ChatComposer on first-load when agent is set and messages are empty", () => {
		mockUseChatContext.mockReturnValue({
			messages: [],
			viewMode: "chat",
			setViewMode: vi.fn(),
		});

		render(
			<ChatPanel
				agent={{
					id: "agent1",
					name: "Test Agent",
					description: "desc",
					model: "gpt-4",
					tools: [],
				}}
				chatNav={<div data-testid="chat-nav" />}
				showSandboxStatus={true}
			/>,
		);

		const composer = screen.getByTestId("chat-composer");
		expect(composer).toBeInTheDocument();
		expect(composer).toHaveAttribute("data-show-agent-menu", "true");
		expect(composer).toHaveAttribute("data-show-sandbox-status", "true");
		expect(screen.getByTestId("agent-section")).toBeInTheDocument();
	});
});
