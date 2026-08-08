import "@testing-library/jest-dom";
import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

// Mock sonner
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
		info: vi.fn(),
	},
}));

// Mock router hooks so navigation is observable
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
	useNavigate: () => mockNavigate,
	useParams: () => ({ memoryId: "mem-1" }),
}));

// Mock MemoryService
const mockGet = vi.fn();
vi.mock("@/lib/services/memoryService", () => ({
	default: {
		get: (...args: any[]) => mockGet(...args),
		update: vi.fn(),
		toggle: vi.fn(),
		delete: vi.fn(),
	},
}));

// Heavy layout/editor shells are irrelevant to the load-failure path
vi.mock("@/layouts/chat-layout-v2", () => ({
	default: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));
vi.mock("@/components/nav/ChatNav", () => ({ ChatNav: () => null }));
vi.mock("@/components/inputs/MonacoEditor", () => ({ default: () => null }));

import MemoryEditPage, { MEMORY_LOAD_TOAST_ID } from "@/pages/memories/edit";

describe("MemoryEditPage load failure", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("announces and redirects exactly once under a StrictMode double mount", async () => {
		const { toast } = await import("sonner");
		mockGet.mockRejectedValue(new Error("boom"));

		render(
			<StrictMode>
				<MemoryEditPage />
			</StrictMode>,
		);

		// The effect is double-invoked, so the service is hit twice...
		await waitFor(() => {
			expect(mockGet.mock.calls.length).toBeGreaterThanOrEqual(2);
		});

		// ...but the user-visible reaction must fire exactly once.
		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledTimes(1);
		});
		expect(toast.error).toHaveBeenCalledTimes(1);
		expect(toast.error).toHaveBeenCalledWith("Failed to load memory", {
			id: MEMORY_LOAD_TOAST_ID,
		});
		expect(mockNavigate).toHaveBeenCalledWith("/memories");
	});
});
