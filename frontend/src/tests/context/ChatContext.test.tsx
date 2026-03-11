import * as React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import ChatProvider, { useChatContext } from "@/context/ChatContext";

const {
	getSettingsMock,
	patchDefaultsMock,
	getMemoryFilesMock,
	toastErrorMock,
	toastSuccessMock,
	clearQueueMock,
	consoleErrorMock,
} = vi.hoisted(() => ({
	getSettingsMock: vi.fn(),
	patchDefaultsMock: vi.fn(),
	getMemoryFilesMock: vi.fn(),
	toastErrorMock: vi.fn(),
	toastSuccessMock: vi.fn(),
	clearQueueMock: vi.fn(),
	consoleErrorMock: vi.fn(),
}));

vi.mock("@/hooks/useConfigHook", () => ({
	default: () => ({}),
}));

vi.mock("@/hooks/useImageHook", () => ({
	default: () => ({}),
}));

vi.mock("@/hooks/useThread", () => ({
	default: () => ({}),
}));

vi.mock("@/hooks/useModel", () => ({
	default: () => ({}),
}));

vi.mock("@/hooks/useMessageQueue", () => ({
	default: () => ({
		clearQueue: clearQueueMock,
	}),
}));

vi.mock("@/hooks/useChat", () => ({
	default: function useChatMock() {
		const [filesMap, setFilesMap] = React.useState(new Map<string, any>());
		const [submissionFiles, setSubmissionFiles] = React.useState<
			Record<string, any>
		>({});
		const [messages, setMessages] = React.useState<any[]>([]);
		const [metadata, setMetadata] = React.useState<Record<string, any>>({});
		const [viewMode, setViewMode] = React.useState<"chat" | "editor">("chat");
		const [controller, setController] = React.useState<AbortController | null>(
			null,
		);

		return {
			controller,
			setController,
			handleSubmit: vi.fn(),
			filesMap,
			setFilesMap,
			submissionFiles,
			setSubmissionFiles,
			messages,
			setMessages,
			clearMessages: () => {
				setMessages([]);
				setFilesMap(new Map());
			},
			metadata,
			setMetadata,
			resetToDefault: vi.fn(),
			viewMode,
			setViewMode,
		};
	},
}));

vi.mock("@/lib/services/memoryService", () => ({
	default: {
		getFiles: getMemoryFilesMock,
	},
}));

vi.mock("@/lib/services/userSettingsService", () => ({
	getSettings: getSettingsMock,
	patchDefaults: patchDefaultsMock,
}));

vi.mock("@/lib/utils/auth", () => ({
	getAuthToken: () => "token",
}));

vi.mock("sonner", () => ({
	toast: {
		error: toastErrorMock,
		success: toastSuccessMock,
	},
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<ChatProvider>{children}</ChatProvider>
);

const waitForHydration = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

describe("ChatContext persistent files", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(consoleErrorMock);
		getSettingsMock.mockResolvedValue({
			defaults: {
				files: {
					"/settings.md": {
						content: ["settings"],
						created_at: "2024-01-01T00:00:00Z",
						modified_at: "2024-01-01T00:00:00Z",
					},
				},
				deleted_files: ["/legacy-tombstone.md"],
			},
			provider_keys: [],
		});
		getMemoryFilesMock.mockResolvedValue({
			"/memory/notes.md": {
				content: ["memory"],
				created_at: "2024-01-02T00:00:00Z",
				modified_at: "2024-01-02T00:00:00Z",
			},
			"/memory/nested/todo.md": {
				content: ["todo"],
				created_at: "2024-01-03T00:00:00Z",
				modified_at: "2024-01-03T00:00:00Z",
			},
		});
		patchDefaultsMock.mockResolvedValue({});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("hydrates settings and memory files when the provider mounts", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		expect(result.current.fileSystem.has("/settings.md")).toBe(true);
		expect(result.current.fileSystem.has("/memory/notes.md")).toBe(true);
		expect(result.current.fileSystem.has("/memory/nested/todo.md")).toBe(true);
		expect(result.current.filesMap.get("__context_files__")).toEqual({
			"/settings.md": {
				content: ["settings"],
				created_at: "2024-01-01T00:00:00Z",
				modified_at: "2024-01-01T00:00:00Z",
			},
			"/memory/notes.md": {
				content: ["memory"],
				created_at: "2024-01-02T00:00:00Z",
				modified_at: "2024-01-02T00:00:00Z",
			},
			"/memory/nested/todo.md": {
				content: ["todo"],
				created_at: "2024-01-03T00:00:00Z",
				modified_at: "2024-01-03T00:00:00Z",
			},
		});
		expect(result.current.submissionFiles).toEqual({
			"/settings.md": {
				content: ["settings"],
				created_at: "2024-01-01T00:00:00Z",
				modified_at: "2024-01-01T00:00:00Z",
			},
			"/memory/notes.md": {
				content: ["memory"],
				created_at: "2024-01-02T00:00:00Z",
				modified_at: "2024-01-02T00:00:00Z",
			},
			"/memory/nested/todo.md": {
				content: ["todo"],
				created_at: "2024-01-03T00:00:00Z",
				modified_at: "2024-01-03T00:00:00Z",
			},
		});
	});

	it("autosaves only persisted settings files plus user workspace files", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.createFile("/profile.md", "three");
		});

		await act(async () => {
			vi.advanceTimersByTime(500);
			await Promise.resolve();
		});

		expect(patchDefaultsMock).toHaveBeenCalledTimes(1);
		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {
				"/settings.md": {
					content: ["settings"],
					created_at: "2024-01-01T00:00:00Z",
					modified_at: "2024-01-01T00:00:00Z",
				},
				"/profile.md": expect.objectContaining({
					content: ["three"],
				}),
			},
			deleted_files: [],
		});
	});

	it("deleting a folder removes descendant files from fileSystem, tabs, and dirty state", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.markDirty("/memory/notes.md");
			result.current.deletePath("/memory");
		});

		expect(result.current.fileSystem.has("/memory/notes.md")).toBe(false);
		expect(result.current.fileSystem.has("/memory/nested/todo.md")).toBe(false);
		expect(result.current.openTabs).not.toContain("/memory/notes.md");
		expect(result.current.openTabs).not.toContain("/memory/nested/todo.md");
		expect(result.current.dirtyFiles.has("/memory/notes.md")).toBe(false);
	});

	it("deleting a persisted file removes it from the next saved defaults.files payload", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.deleteFile("/settings.md");
		});

		await act(async () => {
			vi.advanceTimersByTime(500);
			await Promise.resolve();
		});

		expect(patchDefaultsMock).toHaveBeenCalledTimes(1);
		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {},
			deleted_files: [],
		});
		expect(result.current.submissionFiles).not.toHaveProperty("/settings.md");
	});

	it("deleting a memory-backed file hides it for the session and reload restores it", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.deleteFile("/memory/notes.md");
		});

		expect(result.current.fileSystem.has("/memory/notes.md")).toBe(false);

		await act(async () => {
			await result.current.loadPersistentContextFiles();
		});

		expect(result.current.fileSystem.has("/memory/notes.md")).toBe(true);
	});

	it("renaming a memory-backed file promotes it into the persisted payload", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.renameFile("/memory/notes.md", "/renamed.md");
		});

		await act(async () => {
			vi.advanceTimersByTime(500);
			await Promise.resolve();
		});

		expect(patchDefaultsMock).toHaveBeenCalledTimes(1);
		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {
				"/settings.md": {
					content: ["settings"],
					created_at: "2024-01-01T00:00:00Z",
					modified_at: "2024-01-01T00:00:00Z",
				},
				"/renamed.md": {
					content: ["memory"],
					created_at: "2024-01-02T00:00:00Z",
					modified_at: expect.any(String),
				},
			},
			deleted_files: [],
		});
	});

	it("replaces stale thread-scoped files when switching threads while keeping baseline files", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		await act(async () => {
			result.current.setFilesMap(
				new Map([
					[
						"thread-a",
						{
							"/thread-a.txt": {
								content: ["thread-a"],
								created_at: "2024-01-04T00:00:00Z",
								modified_at: "2024-01-04T00:00:00Z",
							},
						},
					],
				]),
			);
		});

		expect(result.current.fileSystem.has("/thread-a.txt")).toBe(true);
		expect(result.current.fileSystem.has("/settings.md")).toBe(true);

		await act(async () => {
			result.current.setFilesMap(
				new Map([
					[
						"thread-b",
						{
							"/thread-b.txt": {
								content: ["thread-b"],
								created_at: "2024-01-05T00:00:00Z",
								modified_at: "2024-01-05T00:00:00Z",
							},
						},
					],
				]),
			);
		});

		expect(result.current.fileSystem.has("/thread-a.txt")).toBe(false);
		expect(result.current.fileSystem.has("/thread-b.txt")).toBe(true);
		expect(result.current.fileSystem.has("/memory/notes.md")).toBe(true);
	});

	it("clears thread-scoped files without dropping the stable baseline", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		await act(async () => {
			result.current.setFilesMap(
				new Map([
					[
						"thread-a",
						{
							"/thread-a.txt": {
								content: ["thread-a"],
								created_at: "2024-01-04T00:00:00Z",
								modified_at: "2024-01-04T00:00:00Z",
							},
						},
					],
				]),
			);
		});

		expect(result.current.fileSystem.has("/thread-a.txt")).toBe(true);

		act(() => {
			result.current.clearThreadScopedFiles();
		});

		expect(result.current.fileSystem.has("/thread-a.txt")).toBe(false);
		expect(result.current.fileSystem.has("/settings.md")).toBe(true);
		expect(result.current.fileSystem.has("/memory/notes.md")).toBe(true);
	});

	it("manual save clears dirty state only after a successful save", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.markDirty("/memory/notes.md");
			result.current.updateFile("/memory/notes.md", "updated");
		});

		expect(result.current.dirtyFiles.has("/memory/notes.md")).toBe(true);
		expect(result.current.hasUnsavedPersistentChanges).toBe(true);

		let saved = false;
		await act(async () => {
			saved = await result.current.savePersistentContextFiles({
				reason: "manual",
				showSuccessToast: true,
				force: true,
			});
		});

		expect(saved).toBe(true);
		expect(patchDefaultsMock).toHaveBeenCalledTimes(1);
		expect(toastSuccessMock).toHaveBeenCalledWith("Changes saved");
		expect(result.current.dirtyFiles.has("/memory/notes.md")).toBe(false);
		expect(result.current.hasUnsavedPersistentChanges).toBe(false);
	});

	it("manual save failure keeps dirty state and shows an error toast", async () => {
		patchDefaultsMock.mockRejectedValueOnce(new Error("save failed"));
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.markDirty("/memory/notes.md");
			result.current.updateFile("/memory/notes.md", "updated");
		});

		let saved = true;
		await act(async () => {
			saved = await result.current.savePersistentContextFiles({
				reason: "manual",
				showSuccessToast: true,
				force: true,
			});
		});

		expect(saved).toBe(false);
		expect(toastErrorMock).toHaveBeenCalledWith("Failed to save context files");
		expect(toastSuccessMock).not.toHaveBeenCalled();
		expect(result.current.dirtyFiles.has("/memory/notes.md")).toBe(true);
		expect(result.current.hasUnsavedPersistentChanges).toBe(true);
	});

	it("manual save is allowed while streaming even though autosave is suppressed", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.markDirty("/memory/notes.md");
			result.current.updateFile("/memory/notes.md", "streaming change");
			result.current.setController(new AbortController());
		});

		await act(async () => {
			vi.advanceTimersByTime(500);
			await Promise.resolve();
		});

		expect(patchDefaultsMock).not.toHaveBeenCalled();

		await act(async () => {
			await result.current.savePersistentContextFiles({
				reason: "manual",
				showSuccessToast: true,
				force: true,
			});
		});

		expect(patchDefaultsMock).toHaveBeenCalledTimes(1);
		expect(toastSuccessMock).toHaveBeenCalledWith("Changes saved");
	});
});
