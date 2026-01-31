import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServerCard } from "@/components/cards/ServerCard";
import { McpServerConfig } from "@/lib/entities";

const mockServer: McpServerConfig = {
	id: "server-1",
	name: "Test Server",
	slug: "test-server",
	url: "https://mcp.example.com/sse",
	transport: "sse",
	config: null,
	user_id: "user-1",
	created_at: "2026-01-15T00:00:00Z",
};

describe("ServerCard", () => {
	it("renders server name and URL", () => {
		render(<ServerCard server={mockServer} />);
		expect(screen.getByText("Test Server")).toBeInTheDocument();
		expect(screen.getByText("https://mcp.example.com/sse")).toBeInTheDocument();
	});

	it("renders transport badge as SSE", () => {
		render(<ServerCard server={mockServer} />);
		expect(screen.getByText("SSE")).toBeInTheDocument();
	});

	it("renders Streamable HTTP badge for streamable_http transport", () => {
		const server = { ...mockServer, transport: "streamable_http" as const };
		render(<ServerCard server={server} />);
		expect(screen.getByText("Streamable HTTP")).toBeInTheDocument();
	});

	it("renders created date", () => {
		render(<ServerCard server={mockServer} />);
		const formatted = new Date("2026-01-15T00:00:00Z").toLocaleDateString();
		expect(screen.getByText(formatted)).toBeInTheDocument();
	});

	it("renders dash when no created_at", () => {
		const server = { ...mockServer, created_at: undefined };
		render(<ServerCard server={server} />);
		expect(screen.getByText("—")).toBeInTheDocument();
	});

	it("renders dropdown trigger button", () => {
		render(
			<ServerCard server={mockServer} onEdit={vi.fn()} onDelete={vi.fn()} />,
		);
		expect(screen.getByRole("button")).toBeInTheDocument();
	});
});
