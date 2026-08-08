import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { RunError } from "@/hooks/useChat";

const mockReplayRun = vi.fn();

const chatContextValue: Record<string, any> = {
	streamingRate: null,
	handleSubmit: vi.fn(),
	ttft: null,
	submitStartTime: null,
	appendToQuery: vi.fn(),
	displayModel: "openai:gpt-4.1-mini",
	runError: null as RunError | null,
	replayRun: mockReplayRun,
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

describe("ChatMessages run error banner", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatContextValue.runError = null;
	});

	it("hides the replay button for a non-recoverable failure (no DLQ entry to replay)", () => {
		renderWithRunError({
			runId: "run-1",
			message: "MCP sandbox unreachable: connection refused",
			recoverable: false,
		});

		expect(screen.getByTestId("message-error")).toBeInTheDocument();
		expect(
			screen.getByText("MCP sandbox unreachable: connection refused"),
		).toBeInTheDocument();
		expect(screen.queryByTestId("replay-button")).not.toBeInTheDocument();
	});

	it("renders exactly one replay button for a recoverable failure with a run id", () => {
		renderWithRunError({
			runId: "run-1",
			message: "The request failed permanently.",
			recoverable: true,
		});

		expect(screen.getAllByTestId("replay-button")).toHaveLength(1);
	});

	it("hides the replay button when there is no run id to replay", () => {
		renderWithRunError({
			runId: "",
			message: "The request failed permanently.",
			recoverable: true,
		});

		expect(screen.queryByTestId("replay-button")).not.toBeInTheDocument();
	});

	it("renders the failure heading above the backend message", () => {
		renderWithRunError({
			runId: "run-1",
			message: "Something broke.",
			recoverable: true,
		});

		expect(screen.getByText("The request failed.")).toBeInTheDocument();
	});
});
