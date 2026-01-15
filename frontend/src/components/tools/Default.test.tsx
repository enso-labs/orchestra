import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DefaultTool from "./Default";

// Mock MonacoEditor component to avoid Monaco initialization in tests
vi.mock("@/components/inputs/MonacoEditor", () => ({
	default: ({
		value,
		language,
		readOnly,
	}: {
		value: string;
		language: string;
		readOnly: boolean;
	}) => (
		<div
			data-testid="monaco-editor"
			data-value={value}
			data-language={language}
			data-readonly={readOnly}
		>
			{value}
		</div>
	),
}));

describe("DefaultTool", () => {
	describe("Null/Undefined Input Handling", () => {
		it("renders null for missing selectedToolMessage", () => {
			const { container } = render(
				<DefaultTool selectedToolMessage={null} />
			);
			expect(container.firstChild).toBeNull();
		});

		it("renders null for undefined selectedToolMessage", () => {
			const { container } = render(
				<DefaultTool selectedToolMessage={undefined} />
			);
			expect(container.firstChild).toBeNull();
		});
	});

	describe("Valid JSON Rendering", () => {
		it("renders MonacoEditor for valid object input", () => {
			const message = { args: { key: "value" } };
			render(<DefaultTool selectedToolMessage={message} />);

			const editor = screen.getByTestId("monaco-editor");
			expect(editor).toBeInTheDocument();
			expect(editor).toHaveAttribute("data-language", "json");
			expect(editor).toHaveAttribute("data-readonly", "true");
		});

		it("renders MonacoEditor for valid JSON string input", () => {
			const message = { args: '{"key": "value"}' };
			render(<DefaultTool selectedToolMessage={message} />);

			const editor = screen.getByTestId("monaco-editor");
			expect(editor).toBeInTheDocument();
			expect(editor.textContent).toContain("key");
		});

		it('displays "null" for null input value', () => {
			const message = { args: null };
			render(<DefaultTool selectedToolMessage={message} />);

			const editor = screen.getByTestId("monaco-editor");
			expect(editor).toHaveAttribute("data-value", "null");
		});

		it("displays primitive values correctly", () => {
			const message = { args: "42" };
			render(<DefaultTool selectedToolMessage={message} />);

			const editor = screen.getByTestId("monaco-editor");
			expect(editor).toHaveAttribute("data-value", "42");
		});

		it("formats JSON with pretty printing", () => {
			const message = { args: { nested: { key: "value" } } };
			render(<DefaultTool selectedToolMessage={message} />);

			const editor = screen.getByTestId("monaco-editor");
			const value = editor.getAttribute("data-value");
			// Pretty printed JSON should have newlines and indentation
			expect(value).toContain("\n");
			expect(value).toContain("  ");
		});
	});

	describe("Error Handling", () => {
		it("shows error state for invalid JSON string", () => {
			const message = { args: "not valid json {" };
			render(<DefaultTool selectedToolMessage={message} />);

			expect(screen.getByText("Error parsing JSON")).toBeInTheDocument();
		});

		it("displays raw content in error fallback", () => {
			const invalidJson = "invalid json content";
			const message = { args: invalidJson };
			render(<DefaultTool selectedToolMessage={message} />);

			expect(screen.getByText(invalidJson)).toBeInTheDocument();
		});
	});

	describe("Input Field Priority", () => {
		it("extracts input from args field first", () => {
			const message = {
				args: { from: "args" },
				input: { from: "input" },
				content: { from: "content" },
			};
			render(<DefaultTool selectedToolMessage={message} />);

			const editor = screen.getByTestId("monaco-editor");
			expect(editor.textContent).toContain("args");
		});

		it("falls back to input field if args missing", () => {
			const message = {
				input: { from: "input" },
				content: { from: "content" },
			};
			render(<DefaultTool selectedToolMessage={message} />);

			const editor = screen.getByTestId("monaco-editor");
			expect(editor.textContent).toContain("input");
		});

		it("falls back to content field if input missing", () => {
			const message = {
				content: { from: "content" },
			};
			render(<DefaultTool selectedToolMessage={message} />);

			const editor = screen.getByTestId("monaco-editor");
			expect(editor.textContent).toContain("content");
		});
	});

	describe("Props Compatibility", () => {
		it("accepts collapsed prop without error", () => {
			const message = { args: { key: "value" } };
			expect(() => {
				render(<DefaultTool selectedToolMessage={message} collapsed={true} />);
			}).not.toThrow();
		});

		it("accepts collapsed=false prop without error", () => {
			const message = { args: { key: "value" } };
			expect(() => {
				render(<DefaultTool selectedToolMessage={message} collapsed={false} />);
			}).not.toThrow();
		});
	});
});
