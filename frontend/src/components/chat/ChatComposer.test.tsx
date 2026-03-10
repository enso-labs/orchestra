import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatComposer from "./ChatComposer";

vi.mock("@/components/inputs/ChatInput", () => ({
	default: () => <div data-testid="chat-input" />,
}));

vi.mock("@/components/chat/ChatUtilityRow", () => ({
	default: () => <div data-testid="chat-utility-row" />,
}));

describe("ChatComposer", () => {
	it("renders the sandbox status above the chat input when enabled", () => {
		render(<ChatComposer showAgentMenu={true} showSandboxStatus={true} />);

		const sandboxStatus = screen.getByTestId("chat-utility-row");
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

		expect(screen.queryByTestId("chat-utility-row")).not.toBeInTheDocument();
		expect(screen.getByTestId("chat-input")).toBeInTheDocument();
	});
});
