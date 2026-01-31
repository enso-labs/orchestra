import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ServerForm } from "@/components/forms/servers/ServerForm";
import { McpServerConfig } from "@/lib/entities";

const mockHandleCreateServer = vi.fn();
const mockHandleUpdateServer = vi.fn();
const mockHandleTestConnection = vi.fn();

vi.mock("@/hooks/useServer", () => ({
	default: () => ({
		handleCreateServer: mockHandleCreateServer,
		handleUpdateServer: mockHandleUpdateServer,
		handleTestConnection: mockHandleTestConnection,
		servers: [],
		loading: false,
		error: null,
		handleGetServers: vi.fn(),
		handleGetServer: vi.fn(),
		handleDeleteServer: vi.fn(),
		handleDiscoverTools: vi.fn(),
	}),
}));

const mockServer: McpServerConfig = {
	id: "server-1",
	name: "Existing Server",
	slug: "existing-server",
	url: "https://mcp.example.com/sse",
	transport: "sse",
	config: { headers: { "x-api-key": "secret" } },
	user_id: "user-1",
};

describe("ServerForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders create mode with empty fields", () => {
		render(<ServerForm />);
		expect(screen.getByText("Create Server")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("My MCP Server")).toHaveValue("");
		expect(
			screen.getByPlaceholderText("https://mcp.example.com/sse"),
		).toHaveValue("");
	});

	it("renders edit mode with populated fields", () => {
		render(<ServerForm server={mockServer} />);
		expect(screen.getByText("Update Server")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("My MCP Server")).toHaveValue(
			"Existing Server",
		);
		expect(
			screen.getByPlaceholderText("https://mcp.example.com/sse"),
		).toHaveValue("https://mcp.example.com/sse");
	});

	it("renders cancel button when onCancel provided", () => {
		const onCancel = vi.fn();
		render(<ServerForm onCancel={onCancel} />);
		expect(screen.getByText("Cancel")).toBeInTheDocument();
	});

	it("does not render cancel button when onCancel not provided", () => {
		render(<ServerForm />);
		expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
	});

	it("calls onCancel when cancel clicked", () => {
		const onCancel = vi.fn();
		render(<ServerForm onCancel={onCancel} />);
		fireEvent.click(screen.getByText("Cancel"));
		expect(onCancel).toHaveBeenCalled();
	});

	it("shows validation errors for empty required fields on submit", async () => {
		render(<ServerForm />);
		fireEvent.click(screen.getByText("Create Server"));

		await waitFor(() => {
			expect(
				screen.getByText("Name must be at least 2 characters."),
			).toBeInTheDocument();
		});
	});

	it("shows Test Connection button", () => {
		render(<ServerForm />);
		expect(screen.getByText("Test Connection")).toBeInTheDocument();
	});

	it("calls handleCreateServer on valid create submission", async () => {
		const onSuccess = vi.fn();
		const createdServer = { ...mockServer, id: "new-1" };
		mockHandleCreateServer.mockResolvedValue(createdServer);

		render(<ServerForm onSuccess={onSuccess} />);

		fireEvent.change(screen.getByPlaceholderText("My MCP Server"), {
			target: { value: "New Server" },
		});
		fireEvent.change(
			screen.getByPlaceholderText("https://mcp.example.com/sse"),
			{
				target: { value: "https://example.com/mcp" },
			},
		);
		fireEvent.click(screen.getByText("Create Server"));

		await waitFor(() => {
			expect(mockHandleCreateServer).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "New Server",
					url: "https://example.com/mcp",
					transport: "sse",
					config: null,
				}),
			);
		});
	});

	it("calls handleUpdateServer on valid edit submission", async () => {
		const onSuccess = vi.fn();
		mockHandleUpdateServer.mockResolvedValue(mockServer);

		render(<ServerForm server={mockServer} onSuccess={onSuccess} />);

		fireEvent.change(screen.getByPlaceholderText("My MCP Server"), {
			target: { value: "Updated Name" },
		});
		fireEvent.click(screen.getByText("Update Server"));

		await waitFor(() => {
			expect(mockHandleUpdateServer).toHaveBeenCalledWith(
				"server-1",
				expect.objectContaining({ name: "Updated Name" }),
			);
		});
	});

	it("calls handleTestConnection when test button clicked with valid URL", async () => {
		mockHandleTestConnection.mockResolvedValue({
			success: true,
			message: "Connected",
			tools_count: 5,
		});

		render(<ServerForm />);

		fireEvent.change(
			screen.getByPlaceholderText("https://mcp.example.com/sse"),
			{
				target: { value: "https://example.com/mcp" },
			},
		);
		fireEvent.click(screen.getByText("Test Connection"));

		await waitFor(() => {
			expect(mockHandleTestConnection).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://example.com/mcp",
					transport: "sse",
				}),
			);
		});
	});

	it("shows success result after test connection", async () => {
		mockHandleTestConnection.mockResolvedValue({
			success: true,
			message: "Connected",
			tools_count: 3,
		});

		render(<ServerForm />);

		fireEvent.change(
			screen.getByPlaceholderText("https://mcp.example.com/sse"),
			{
				target: { value: "https://example.com/mcp" },
			},
		);
		fireEvent.click(screen.getByText("Test Connection"));

		await waitFor(() => {
			expect(screen.getByText("Connected (3 tools)")).toBeInTheDocument();
		});
	});

	it("shows failure result after test connection", async () => {
		mockHandleTestConnection.mockResolvedValue({
			success: false,
			message: "Connection refused",
		});

		render(<ServerForm />);

		fireEvent.change(
			screen.getByPlaceholderText("https://mcp.example.com/sse"),
			{
				target: { value: "https://example.com/mcp" },
			},
		);
		fireEvent.click(screen.getByText("Test Connection"));

		await waitFor(() => {
			expect(screen.getByText("Connection refused")).toBeInTheDocument();
		});
	});
});
