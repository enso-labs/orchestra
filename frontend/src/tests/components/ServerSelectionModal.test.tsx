import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServerSelectionModal } from "@/components/modals/ServerSelectionModal";
import { McpServerConfig } from "@/lib/entities";

const mockServers: McpServerConfig[] = [
	{
		id: "s1",
		name: "Server One",
		slug: "server-one",
		url: "https://one.example.com/sse",
		transport: "sse",
		config: null,
		user_id: "user-1",
	},
	{
		id: "s2",
		name: "Server Two",
		slug: "server-two",
		url: "https://two.example.com/mcp",
		transport: "streamable_http",
		config: null,
		user_id: "user-1",
	},
	{
		id: "s3",
		name: "Alpha Server",
		slug: "alpha-server",
		url: "https://alpha.example.com/sse",
		transport: "sse",
		config: null,
		user_id: "user-1",
	},
];

const mockHandleGetServers = vi.fn();

vi.mock("@/hooks/useServer", () => ({
	default: () => ({
		servers: mockServers,
		loading: false,
		handleGetServers: mockHandleGetServers,
		handleCreateServer: vi.fn(),
		handleUpdateServer: vi.fn(),
		handleDeleteServer: vi.fn(),
		handleTestConnection: vi.fn(),
		handleGetServer: vi.fn(),
		handleDiscoverTools: vi.fn(),
		error: null,
	}),
}));

describe("ServerSelectionModal", () => {
	const defaultProps = {
		isOpen: true,
		onClose: vi.fn(),
		onSelect: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders modal title when open", () => {
		render(<ServerSelectionModal {...defaultProps} />);
		expect(screen.getByText("Import from Saved Servers")).toBeInTheDocument();
	});

	it("fetches servers when opened", () => {
		render(<ServerSelectionModal {...defaultProps} />);
		expect(mockHandleGetServers).toHaveBeenCalled();
	});

	it("lists all available servers", () => {
		render(<ServerSelectionModal {...defaultProps} />);
		expect(screen.getByText("Server One")).toBeInTheDocument();
		expect(screen.getByText("Server Two")).toBeInTheDocument();
		expect(screen.getByText("Alpha Server")).toBeInTheDocument();
	});

	it("filters servers by search", () => {
		render(<ServerSelectionModal {...defaultProps} />);

		fireEvent.change(screen.getByPlaceholderText("Search servers..."), {
			target: { value: "Alpha" },
		});

		expect(screen.getByText("Alpha Server")).toBeInTheDocument();
		expect(screen.queryByText("Server One")).not.toBeInTheDocument();
		expect(screen.queryByText("Server Two")).not.toBeInTheDocument();
	});

	it("excludes servers by excludeIds", () => {
		render(
			<ServerSelectionModal {...defaultProps} excludeIds={["s1", "s3"]} />,
		);
		expect(screen.queryByText("Server One")).not.toBeInTheDocument();
		expect(screen.getByText("Server Two")).toBeInTheDocument();
		expect(screen.queryByText("Alpha Server")).not.toBeInTheDocument();
	});

	it("shows selection count when servers selected", () => {
		render(<ServerSelectionModal {...defaultProps} />);

		fireEvent.click(screen.getByText("Server One"));
		expect(screen.getByText("1 server selected")).toBeInTheDocument();

		fireEvent.click(screen.getByText("Server Two"));
		expect(screen.getByText("2 servers selected")).toBeInTheDocument();
	});

	it("toggles server selection on click", () => {
		render(<ServerSelectionModal {...defaultProps} />);

		fireEvent.click(screen.getByText("Server One"));
		expect(screen.getByText("1 server selected")).toBeInTheDocument();

		fireEvent.click(screen.getByText("Server One"));
		expect(screen.getByText("Select servers to import")).toBeInTheDocument();
	});

	it("Import Selected button disabled when nothing selected", () => {
		render(<ServerSelectionModal {...defaultProps} />);
		const importBtn = screen.getByText("Import Selected");
		expect(importBtn.closest("button")).toBeDisabled();
	});

	it("calls onSelect and onClose when Import Selected clicked", () => {
		const onSelect = vi.fn();
		const onClose = vi.fn();
		render(
			<ServerSelectionModal
				{...defaultProps}
				onSelect={onSelect}
				onClose={onClose}
			/>,
		);

		fireEvent.click(screen.getByText("Server One"));
		fireEvent.click(screen.getByText("Import Selected"));

		expect(onSelect).toHaveBeenCalledWith([mockServers[0]]);
		expect(onClose).toHaveBeenCalled();
	});

	it("calls onClose when Cancel clicked", () => {
		const onClose = vi.fn();
		render(<ServerSelectionModal {...defaultProps} onClose={onClose} />);

		fireEvent.click(screen.getByText("Cancel"));
		expect(onClose).toHaveBeenCalled();
	});

	it("displays transport badges", () => {
		render(<ServerSelectionModal {...defaultProps} />);
		const sseBadges = screen.getAllByText("SSE");
		expect(sseBadges.length).toBe(2);
		expect(screen.getByText("Streamable HTTP")).toBeInTheDocument();
	});
});
