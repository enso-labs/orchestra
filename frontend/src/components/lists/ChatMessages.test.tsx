import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { RunError } from "@/hooks/useChat";

const chatContextValue: Record<string, any> = {
	streamingRate: null,
	handleSubmit: vi.fn(),
	ttft: null,
	submitStartTime: null,
	appendToQuery: vi.fn(),
	displayModel: "openai:gpt-4.1-mini",
	runError: null as RunError | null,
	streamStatus: null,
};

vi.mock("@/context/AppContext", () => ({
	useAppContext: () => ({ loading: false, loadingMessage: "" }),
}));

vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => chatContextValue,
}));

import ChatMessages from "./ChatMessages";

const renderWithRunError = (runError: RunError) => {
	chatContextValue.runError = runError;
	return render(<ChatMessages messages={[]} />);
};

describe("ChatMessages run states", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatContextValue.runError = null;
		chatContextValue.streamStatus = null;
	});

	it("renders an accessible inline error with no legacy replay action", () => {
		renderWithRunError({
			runId: "run-1",
			message: "You do not have access to this thread.",
			recoverable: false,
		});

		expect(screen.getByTestId("message-error")).toHaveAttribute(
			"role",
			"alert",
		);
		expect(
			screen.getByText("You do not have access to this thread."),
		).toBeInTheDocument();
		expect(screen.queryByTestId("replay-button")).not.toBeInTheDocument();
	});

	it("renders cancellation in a polite live region", () => {
		chatContextValue.streamStatus = "The request was stopped.";
		render(<ChatMessages messages={[]} />);

		expect(screen.getByRole("status")).toHaveTextContent(
			"The request was stopped.",
		);
	});
});
