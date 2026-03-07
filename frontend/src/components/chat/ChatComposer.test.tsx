import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatComposer from "./ChatComposer";

vi.mock("@/components/inputs/ChatInput", () => ({
	default: () => <div data-testid="chat-input" />,
}));

vi.mock("@/components/status/ThreadSandboxStatus", () => ({
	default: () => <div data-testid="thread-sandbox-status" />,
}));

describe("ChatComposer", () => {
	it("renders the sandbox status above the chat input when enabled", () => {
		render(<ChatComposer showAgentMenu={true} showSandboxStatus={true} />);

		const sandboxStatus = screen.getByTestId("thread-sandbox-status");
		const chatInput = screen.getByTestId("chat-input");

		expect(sandboxStatus).toBeInTheDocument();
		expect(chatInput).toBeInTheDocument();
		expect(
			sandboxStatus.compareDocumentPosition(chatInput) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("omits the sandbox status when disabled", () => {
		render(<ChatComposer showAgentMenu={true} showSandboxStatus={false} />);

		expect(
			screen.queryByTestId("thread-sandbox-status"),
		).not.toBeInTheDocument();
		expect(screen.getByTestId("chat-input")).toBeInTheDocument();
	});
});
