import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelBadge, getModelIcon, getModelLabel } from "./ModelBadge";

describe("ModelBadge", () => {
	it("renders the model label without the provider prefix", () => {
		render(<ModelBadge model="openai:gpt-4o" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent("gpt-4o");
	});

	it("renders for anthropic models", () => {
		render(<ModelBadge model="anthropic:claude-sonnet-4-20250514" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent(
			"claude-sonnet-4-20250514",
		);
	});

	it("renders for ollama models", () => {
		render(<ModelBadge model="ollama:llama3" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent("llama3");
	});

	it("renders for google models", () => {
		render(<ModelBadge model="google:gemini-pro" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent("gemini-pro");
	});

	it("renders for google_genai models", () => {
		render(<ModelBadge model="google_genai:gemini-pro" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent("gemini-pro");
	});

	it("renders for bedrock models", () => {
		render(<ModelBadge model="bedrock_converse:us.anthropic.claude" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent(
			"us.anthropic.claude",
		);
	});

	it("renders for groq models", () => {
		render(<ModelBadge model="groq:llama-3.1-70b" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent(
			"llama-3.1-70b",
		);
	});

	it("renders for xai models", () => {
		render(<ModelBadge model="xai:grok-beta" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent("grok-beta");
	});

	it("handles model string without provider prefix", () => {
		render(<ModelBadge model="some-model" />);
		expect(screen.getByTestId("model-badge")).toHaveTextContent("some-model");
	});

	it("has no click handlers or interactive elements", () => {
		const { container } = render(<ModelBadge model="openai:gpt-4o" />);
		const badge = screen.getByTestId("model-badge");

		// Should be a span, not a button or anchor
		expect(badge.tagName).toBe("SPAN");

		// No buttons, links, or inputs inside
		expect(container.querySelectorAll("button")).toHaveLength(0);
		expect(container.querySelectorAll("a")).toHaveLength(0);
		expect(container.querySelectorAll("input")).toHaveLength(0);
		expect(container.querySelectorAll("select")).toHaveLength(0);
	});

	it("accepts custom className", () => {
		render(<ModelBadge model="openai:gpt-4o" className="custom-class" />);
		expect(screen.getByTestId("model-badge")).toHaveClass("custom-class");
	});
});

describe("getModelLabel", () => {
	it("strips provider prefix", () => {
		expect(getModelLabel("openai:gpt-4o")).toBe("gpt-4o");
		expect(getModelLabel("anthropic:claude-sonnet-4-20250514")).toBe(
			"claude-sonnet-4-20250514",
		);
	});

	it("returns full string if no colon", () => {
		expect(getModelLabel("gpt-4o")).toBe("gpt-4o");
	});
});

describe("getModelIcon", () => {
	it("returns null for unknown provider", () => {
		expect(getModelIcon("unknown:model")).toBeNull();
	});

	it("returns an icon for known providers", () => {
		expect(getModelIcon("openai:gpt-4o")).not.toBeNull();
		expect(getModelIcon("anthropic:claude")).not.toBeNull();
	});
});
