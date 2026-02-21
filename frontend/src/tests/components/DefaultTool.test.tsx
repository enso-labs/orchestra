import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DefaultTool from "@/components/tools/Default";

// Mock useTheme hook
vi.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "dark" }),
}));

// Mock JsonView to avoid complex rendering
vi.mock("@uiw/react-json-view", () => ({
	default: ({ value }: { value: any }) => (
		<div data-testid="json-view">{JSON.stringify(value)}</div>
	),
}));
vi.mock("@uiw/react-json-view/githubDark", () => ({
	githubDarkTheme: {},
}));
vi.mock("@uiw/react-json-view/githubLight", () => ({
	githubLightTheme: {},
}));

// Mock SyntaxHighlighter to render children as text
vi.mock("react-syntax-highlighter", () => ({
	Prism: ({ children }: { children: string }) => (
		<pre data-testid="syntax-highlighter">{children}</pre>
	),
}));
vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
	oneDark: {},
	oneLight: {},
}));

describe("DefaultTool", () => {
	it("returns null when no selectedToolMessage", () => {
		const { container } = render(<DefaultTool selectedToolMessage={null} />);
		expect(container.innerHTML).toBe("");
	});

	it("renders JsonView for valid parsed JSON object input", () => {
		const message = { input: { key: "value", nested: { a: 1 } } };
		render(<DefaultTool selectedToolMessage={message} />);
		expect(screen.getByTestId("json-view")).toBeTruthy();
	});

	it("renders JsonView for valid JSON string input", () => {
		const message = { input: '{"key": "value"}' };
		render(<DefaultTool selectedToolMessage={message} />);
		expect(screen.getByTestId("json-view")).toBeTruthy();
	});

	it("renders syntax-highlighted text for incomplete streaming JSON (regression: #815)", () => {
		// Simulate partially-streamed tool call args — incomplete JSON
		const message = { input: '{"query": "hello wor' };
		render(<DefaultTool selectedToolMessage={message} />);

		// Should NOT show an error message
		expect(screen.queryByText(/Error parsing JSON/i)).toBeNull();

		// Should show the raw text in a syntax highlighter
		const highlighter = screen.getByTestId("syntax-highlighter");
		expect(highlighter).toBeTruthy();
		expect(highlighter.textContent).toBe('{"query": "hello wor');
	});

	it("renders syntax-highlighted text for single opening brace (early stream)", () => {
		const message = { input: "{" };
		render(<DefaultTool selectedToolMessage={message} />);

		expect(screen.queryByText(/Error parsing JSON/i)).toBeNull();
		expect(screen.getByTestId("syntax-highlighter")).toBeTruthy();
	});

	it("renders null display for null/undefined input", () => {
		const message = { input: null };
		render(<DefaultTool selectedToolMessage={message} />);
		expect(screen.getByText("null")).toBeTruthy();
	});

	it("renders null display for empty string input", () => {
		const message = { input: "" };
		render(<DefaultTool selectedToolMessage={message} />);
		expect(screen.getByText("null")).toBeTruthy();
	});

	it("prefers args over input over content", () => {
		const message = {
			args: { from: "args" },
			input: { from: "input" },
			content: { from: "content" },
		};
		render(<DefaultTool selectedToolMessage={message} />);
		expect(screen.getByTestId("json-view").textContent).toContain("args");
	});

	it("renders primitive JSON values directly", () => {
		const message = { input: '"just a string"' };
		render(<DefaultTool selectedToolMessage={message} />);
		expect(screen.getByText("just a string")).toBeTruthy();
	});

	it("renders number JSON values directly", () => {
		const message = { input: "42" };
		render(<DefaultTool selectedToolMessage={message} />);
		expect(screen.getByText("42")).toBeTruthy();
	});
});
