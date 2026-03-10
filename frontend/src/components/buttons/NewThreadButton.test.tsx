import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NewThreadButton from "./NewThreadButton";

const mockNavigate = vi.fn();
const mockUseChatContext = vi.fn();

vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => mockUseChatContext(),
}));

vi.mock("react-router-dom", async () => {
	const actual =
		await vi.importActual<typeof import("react-router-dom")>(
			"react-router-dom",
		);
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock("../ui/button", () => ({
	Button: ({
		children,
		onClick,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button onClick={onClick} {...props}>
			{children}
		</button>
	),
}));

vi.mock("lucide-react", () => ({
	Plus: () => <span>+</span>,
}));

function renderAt(pathname: string) {
	return render(
		<MemoryRouter initialEntries={[pathname]}>
			<Routes>
				<Route path="*" element={<NewThreadButton />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("NewThreadButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUseChatContext.mockReturnValue({
			messages: [{ id: "msg-1" }],
			clearMessages: vi.fn(),
			metadata: { assistant_id: "assistant-1" },
			resetToDefault: vi.fn(),
			loadPersistentContextFiles: vi.fn(),
			clearThreadScopedFiles: vi.fn(),
		});
	});

	it("clears thread-scoped files and reloads the stable baseline on new thread", () => {
		renderAt("/thread/thread-1");

		fireEvent.click(screen.getByTitle("New Chat"));

		const context = mockUseChatContext.mock.results[0].value;
		expect(context.clearMessages).toHaveBeenCalledTimes(1);
		expect(context.clearThreadScopedFiles).toHaveBeenCalledTimes(1);
		expect(context.resetToDefault).toHaveBeenCalledTimes(1);
		expect(context.loadPersistentContextFiles).toHaveBeenCalledTimes(1);
		expect(mockNavigate).toHaveBeenCalledWith("/chat");
	});

	it("navigates assistant thread resets back to the assistant route", () => {
		renderAt("/assistant/assistant-1/thread/thread-1");

		fireEvent.click(screen.getByTitle("New Chat"));

		expect(mockNavigate).toHaveBeenCalledWith("/assistant/assistant-1");
	});

	it("renders nothing when there are no messages", () => {
		mockUseChatContext.mockReturnValue({
			messages: [],
			clearMessages: vi.fn(),
			metadata: {},
			resetToDefault: vi.fn(),
			loadPersistentContextFiles: vi.fn(),
			clearThreadScopedFiles: vi.fn(),
		});

		const { container } = renderAt("/chat");
		expect(container).toBeEmptyDOMElement();
	});
});
