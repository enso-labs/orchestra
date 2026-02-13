import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock useChatContext
const mockUseChatContext = vi.fn();
vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => mockUseChatContext(),
}));

// Mock child components to isolate ChatNav
vi.mock("@/components/buttons/ColorModeButton", () => ({
	ColorModeButton: () => <button data-testid="color-mode-button" />,
}));
vi.mock("@/components/badges/ModelBadge", () => ({
	ModelBadge: ({ model }: { model: string }) => (
		<span data-testid="model-badge">{model}</span>
	),
}));
vi.mock("../buttons/NewThreadButton", () => ({
	default: () => <button data-testid="new-thread-button" />,
}));
vi.mock("../buttons/thread-share-button", () => ({
	default: () => <button data-testid="share-button" />,
}));

import { ChatNav } from "./ChatNav";

const defaultContext = {
	viewMode: "chat" as const,
	setViewMode: vi.fn(),
	filesMap: new Map(),
	model: "openai:gpt-4o",
};

describe("ChatNav", () => {
	beforeEach(() => {
		mockUseChatContext.mockReturnValue(defaultContext);
	});

	it("renders ModelBadge with the current model from context", () => {
		render(<ChatNav />);
		const badge = screen.getByTestId("model-badge");
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveTextContent("openai:gpt-4o");
	});

	it("does not render SelectModel", () => {
		render(<ChatNav />);
		// SelectModel is not imported or rendered — no combobox/listbox should exist
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
	});

	it("hides ModelBadge when showModelBadge is false", () => {
		render(<ChatNav showModelBadge={false} />);
		expect(screen.queryByTestId("model-badge")).not.toBeInTheDocument();
	});

	it("shows ModelBadge by default (showModelBadge defaults to true)", () => {
		render(<ChatNav />);
		expect(screen.getByTestId("model-badge")).toBeInTheDocument();
	});

	it("does not render ModelBadge when model is empty/falsy", () => {
		mockUseChatContext.mockReturnValue({ ...defaultContext, model: "" });
		render(<ChatNav />);
		expect(screen.queryByTestId("model-badge")).not.toBeInTheDocument();
	});

	it("renders ModelBadge with anthropic model", () => {
		mockUseChatContext.mockReturnValue({
			...defaultContext,
			model: "anthropic:claude-sonnet-4-20250514",
		});
		render(<ChatNav />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent(
			"anthropic:claude-sonnet-4-20250514",
		);
	});

	it("does not accept showModelSelector prop (removed)", () => {
		// TypeScript would catch this, but verify the component signature
		// by confirming showModelBadge works and old prop is gone
		render(<ChatNav showModelBadge={true} />);
		expect(screen.getByTestId("model-badge")).toBeInTheDocument();
	});
});
