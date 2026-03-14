import "@testing-library/jest-dom";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	useEffect,
	useMemo,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import NewThreadButton from "@/components/buttons/NewThreadButton";
import { useChatContext } from "@/context/ChatContext";
import useInitialThreadRedirect from "@/hooks/useInitialThreadRedirect";

const mockUseChatContext = vi.fn();
let currentChatContextValue: ReturnType<typeof buildChatContextValue> | null =
	null;

vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => mockUseChatContext(),
}));

function buildChatContextValue(
	messages: Array<{ id: string; content: string }>,
	metadata: { thread_id?: string },
	setResetPending: Dispatch<SetStateAction<boolean>>,
) {
	return {
		messages,
		metadata,
		clearMessages: () => setResetPending(true),
		abortQuery: vi.fn(),
		resetToDefault: vi.fn(),
		loadPersistentContextFiles: vi.fn(),
		clearThreadScopedFiles: vi.fn(),
		clearBackendSyncFiles: vi.fn(),
	};
}

function LocationDisplay() {
	const location = useLocation();

	return <div data-testid="location">{location.pathname}</div>;
}

function ThreadRoute() {
	return <NewThreadButton />;
}

function ChatRoute({ onCreateThread }: { onCreateThread: () => void }) {
	const { metadata, messages } = useChatContext();

	useInitialThreadRedirect({
		threadId: metadata?.thread_id,
		hasMessages: messages.length > 0,
	});

	return <button onClick={onCreateThread}>Create Thread</button>;
}

function RegressionHarness() {
	const [messages, setMessages] = useState([{ id: "msg-1", content: "hello" }]);
	const [metadata, setMetadata] = useState<{ thread_id?: string }>({
		thread_id: "thread-123",
	});
	const [resetPending, setResetPending] = useState(false);

	useEffect(() => {
		if (!resetPending) {
			return;
		}

		let cancelled = false;

		void Promise.resolve().then(() => {
			if (cancelled) {
				return;
			}

			setMessages([]);
			setMetadata({});
			setResetPending(false);
		});

		return () => {
			cancelled = true;
		};
	}, [resetPending]);

	const chatContextValue = useMemo(
		() => buildChatContextValue(messages, metadata, setResetPending),
		[messages, metadata, setResetPending],
	);

	currentChatContextValue = chatContextValue;

	return (
		<MemoryRouter initialEntries={["/thread/thread-123"]}>
			<LocationDisplay />
			<Routes>
				<Route path="/thread/:threadId" element={<ThreadRoute />} />
				<Route
					path="/chat"
					element={
						<ChatRoute
							onCreateThread={() => {
								setMetadata({ thread_id: "thread-456" });
								setMessages([{ id: "msg-2", content: "new thread" }]);
							}}
						/>
					}
				/>
			</Routes>
		</MemoryRouter>
	);
}

describe("new chat thread redirect regression", () => {
	beforeEach(() => {
		currentChatContextValue = null;
		mockUseChatContext.mockReset();
		mockUseChatContext.mockImplementation(() => currentChatContextValue);
	});

	it("stays on /chat after New Chat clears stale state, then redirects for the next real thread id", async () => {
		render(<RegressionHarness />);

		expect(screen.getByTestId("location")).toHaveTextContent(
			"/thread/thread-123",
		);

		fireEvent.click(screen.getByTitle("New Chat"));

		await waitFor(() =>
			expect(screen.getByTestId("location")).toHaveTextContent("/chat"),
		);

		await act(async () => {
			await Promise.resolve();
		});

		expect(screen.getByTestId("location")).toHaveTextContent("/chat");

		fireEvent.click(screen.getByRole("button", { name: "Create Thread" }));

		await waitFor(() =>
			expect(screen.getByTestId("location")).toHaveTextContent(
				"/thread/thread-456",
			),
		);
	});
});
