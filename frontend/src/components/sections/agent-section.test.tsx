import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AgentSection from "./agent-section";

vi.mock("@/components/inputs/ChatInput", () => ({
	default: () => <div data-testid="chat-input" />,
}));

vi.mock("@/components/chat/ChatUtilityRow", () => ({
	default: () => <div data-testid="chat-utility-row" />,
}));

describe("AgentSection", () => {
	const agent = {
		id: "agent-1",
		name: "Test Agent",
		description: "Agent description",
		model: "gpt-4",
		tools: [],
	};

	it("does not render the utility row when sandbox status is disabled", () => {
		render(<AgentSection agent={agent} showSandboxStatus={false} />);

		expect(screen.queryByTestId("chat-utility-row")).not.toBeInTheDocument();
		expect(screen.getByTestId("chat-input")).toBeInTheDocument();
	});

	it("renders the utility row above the input when sandbox status is enabled", () => {
		render(<AgentSection agent={agent} showSandboxStatus={true} />);

		const utilityRow = screen.getByTestId("chat-utility-row");
		const chatInput = screen.getByTestId("chat-input");

		expect(utilityRow).toBeInTheDocument();
		expect(chatInput).toBeInTheDocument();
		expect(
			utilityRow.compareDocumentPosition(chatInput) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});
});
