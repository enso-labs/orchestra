import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { McpServerPanel } from "@/components/modals/ToolSelectionModal/McpServerPanel";

const defaultProps = {
	mcpServers: {
		test_server: {
			transport: "sse" as const,
			url: "http://localhost:3000/mcp",
			headers: {},
			enabled: true,
		},
		disabled_server: {
			transport: "sse" as const,
			url: "http://localhost:4000/mcp",
			headers: {},
			enabled: false,
		},
	},
	mcpTools: [],
	selectedTools: new Set<string>(),
	onToggleSelection: vi.fn(),
	onAddServer: vi.fn(),
	onRemoveServer: vi.fn(),
	onToggleServer: vi.fn(),
	onTestConnection: vi.fn(),
	isLoading: false,
};

describe("McpServerPanel", () => {
	it("renders server names", () => {
		render(<McpServerPanel {...defaultProps} />);
		expect(screen.getByText("test_server")).toBeDefined();
		expect(screen.getByText("disabled_server")).toBeDefined();
	});

	it("renders toggle switches for each server", () => {
		render(<McpServerPanel {...defaultProps} />);
		const toggles = screen.getAllByRole("switch");
		expect(toggles).toHaveLength(2);
	});

	it("calls onToggleServer when switch is clicked", () => {
		const onToggleServer = vi.fn();
		render(
			<McpServerPanel {...defaultProps} onToggleServer={onToggleServer} />,
		);

		const toggles = screen.getAllByRole("switch");
		fireEvent.click(toggles[0]);

		expect(onToggleServer).toHaveBeenCalledWith("test_server");
	});

	it("applies dimmed styling to disabled servers", () => {
		render(<McpServerPanel {...defaultProps} />);
		const disabledToggle = screen.getByLabelText("Toggle disabled_server");
		const card = disabledToggle.closest(".opacity-50");
		expect(card).not.toBeNull();
	});

	it("enabled server does not have dimmed styling", () => {
		render(<McpServerPanel {...defaultProps} />);
		const enabledToggle = screen.getByLabelText("Toggle test_server");
		const card = enabledToggle.closest(".opacity-50");
		expect(card).toBeNull();
	});
});
