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

const flushAutosave = async () => {
	await act(async () => {
		vi.advanceTimersByTime(500);
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
			"/legacy-tombstone.md": {
				content: ["should stay hidden"],
				created_at: "2024-01-04T00:00:00Z",
				modified_at: "2024-01-04T00:00:00Z",
			},
		});
		patchDefaultsMock.mockResolvedValue({});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("hydrates durable settings, memory files, and settings tombstones on mount", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		expect(result.current.fileSystem.has("/settings.md")).toBe(true);
		expect(result.current.fileSystem.has("/memory/notes.md")).toBe(true);
		expect(result.current.fileSystem.has("/memory/nested/todo.md")).toBe(true);
		expect(result.current.fileSystem.has("/legacy-tombstone.md")).toBe(false);
		expect(result.current.deletedFiles).toEqual(["/legacy-tombstone.md"]);
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

	it("autosaves only durable files into defaults.files and carries durable tombstones", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.createFile("/profile.md", "three");
		});

		await flushAutosave();

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
			deleted_files: ["/legacy-tombstone.md"],
		});
	});

	it("deleting a persisted file removes it from the next save payload and records a tombstone", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.deleteFile("/settings.md");
		});

		await flushAutosave();

		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {},
			deleted_files: ["/legacy-tombstone.md", "/settings.md"],
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

	it("deleting a folder removes all matching files in one pass without touching durable survivors", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.createFile("/keep.md", "keep");
			result.current.createFile("/folder/a.md", "a");
			result.current.createFile("/folder/b.md", "b");
			result.current.markDirty("/folder/b.md");
			result.current.selectTab("/keep.md");
			result.current.selectTab("/folder/b.md");
		});

		expect(result.current.activeFile).toBe("/folder/b.md");
		expect(result.current.openTabs).toEqual(
			expect.arrayContaining([
				"/settings.md",
				"/memory/notes.md",
				"/memory/nested/todo.md",
				"/keep.md",
				"/folder/a.md",
				"/folder/b.md",
			]),
		);

		act(() => {
			result.current.deletePath("/folder");
		});

		expect(result.current.fileSystem.has("/folder/a.md")).toBe(false);
		expect(result.current.fileSystem.has("/folder/b.md")).toBe(false);
		expect(result.current.fileSystem.get("/keep.md")?.content).toEqual([
			"keep",
		]);
		expect(result.current.openTabs).toEqual(
			expect.arrayContaining([
				"/settings.md",
				"/memory/notes.md",
				"/memory/nested/todo.md",
				"/keep.md",
			]),
		);
		expect(result.current.openTabs).toHaveLength(4);
		expect(result.current.activeFile).toBe("/keep.md");
		expect(result.current.dirtyFiles.has("/folder/b.md")).toBe(false);
	});

	it("renaming a memory-backed file promotes it and tombstones the original path", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.renameFile("/memory/notes.md", "/renamed.md");
		});

		await flushAutosave();

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
			deleted_files: ["/legacy-tombstone.md", "/memory/notes.md"],
		});
	});

	it("editing a thread-scoped file promotes it into durable settings", async () => {
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
								created_at: "2024-01-05T00:00:00Z",
								modified_at: "2024-01-05T00:00:00Z",
							},
						},
					],
				]),
			);
			await Promise.resolve();
		});

		act(() => {
			result.current.updateFile("/thread-a.txt", "owned");
		});

		await flushAutosave();

		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {
				"/settings.md": {
					content: ["settings"],
					created_at: "2024-01-01T00:00:00Z",
					modified_at: "2024-01-01T00:00:00Z",
				},
				"/thread-a.txt": {
					content: ["owned"],
					created_at: "2024-01-05T00:00:00Z",
					modified_at: expect.any(String),
				},
			},
			deleted_files: ["/legacy-tombstone.md"],
		});
	});

	it("persists streamed thread files so they survive a new-chat reset", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		await act(async () => {
			result.current.setController(new AbortController());
			result.current.setFilesMap(
				new Map([
					[
						"thread-a",
						{
							"/AGENTS.md": {
								content: ["generated"],
								created_at: "2024-01-05T00:00:00Z",
								modified_at: "2024-01-05T00:00:00Z",
							},
						},
					],
				]),
			);
			await Promise.resolve();
		});

		expect(result.current.fileSystem.has("/AGENTS.md")).toBe(true);

		await act(async () => {
			result.current.setController(null);
			await Promise.resolve();
		});

		await flushAutosave();

		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {
				"/settings.md": {
					content: ["settings"],
					created_at: "2024-01-01T00:00:00Z",
					modified_at: "2024-01-01T00:00:00Z",
				},
				"/AGENTS.md": {
					content: ["generated"],
					created_at: "2024-01-05T00:00:00Z",
					modified_at: "2024-01-05T00:00:00Z",
				},
			},
			deleted_files: ["/legacy-tombstone.md"],
		});

		act(() => {
			result.current.clearThreadScopedFiles();
		});

		expect(result.current.fileSystem.has("/AGENTS.md")).toBe(true);
		expect(result.current.submissionFiles).toHaveProperty("/AGENTS.md");
	});

	it("renaming a thread-scoped file promotes the renamed path into durable settings", async () => {
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
								created_at: "2024-01-05T00:00:00Z",
								modified_at: "2024-01-05T00:00:00Z",
							},
						},
					],
				]),
			);
			await Promise.resolve();
		});

		act(() => {
			result.current.renameFile("/thread-a.txt", "/thread-owned.txt");
		});

		await flushAutosave();

		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {
				"/settings.md": {
					content: ["settings"],
					created_at: "2024-01-01T00:00:00Z",
					modified_at: "2024-01-01T00:00:00Z",
				},
				"/thread-owned.txt": {
					content: ["thread-a"],
					created_at: "2024-01-05T00:00:00Z",
					modified_at: expect.any(String),
				},
			},
			deleted_files: ["/legacy-tombstone.md"],
		});
	});

	it("editing a backend-synced file promotes it into durable settings", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.fromBackendFormat({
				"/backend.txt": "generated",
			});
		});

		act(() => {
			result.current.updateFile("/backend.txt", "owned backend");
		});

		await flushAutosave();

		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {
				"/settings.md": {
					content: ["settings"],
					created_at: "2024-01-01T00:00:00Z",
					modified_at: "2024-01-01T00:00:00Z",
				},
				"/backend.txt": {
					content: ["owned backend"],
					created_at: expect.any(String),
					modified_at: expect.any(String),
				},
			},
			deleted_files: ["/legacy-tombstone.md"],
		});
	});

	it("clearing transient thread files keeps durable workspace files and dirty state", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.createFile("/draft.md", "draft");
		});

		act(() => {
			result.current.markDirty("/draft.md");
			result.current.updateFile("/draft.md", "draft change");
		});

		await act(async () => {
			result.current.setFilesMap(
				new Map([
					[
						"thread-a",
						{
							"/thread-a.txt": {
								content: ["thread-a"],
								created_at: "2024-01-05T00:00:00Z",
								modified_at: "2024-01-05T00:00:00Z",
							},
						},
					],
				]),
			);
			await Promise.resolve();
		});

		expect(result.current.fileSystem.has("/thread-a.txt")).toBe(true);
		expect(result.current.fileSystem.get("/draft.md")?.content).toEqual([
			"draft change",
		]);
		expect(result.current.dirtyFiles.has("/draft.md")).toBe(true);

		act(() => {
			result.current.clearThreadScopedFiles();
		});

		expect(result.current.fileSystem.has("/thread-a.txt")).toBe(false);
		expect(result.current.fileSystem.get("/draft.md")?.content).toEqual([
			"draft change",
		]);
		expect(result.current.fileSystem.has("/settings.md")).toBe(true);
		expect(result.current.dirtyFiles.has("/draft.md")).toBe(true);
	});

	it("keeps unsaved durable changes when reloading persistent context before autosave fires", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.createFile("/notes.md", "draft");
		});

		await waitForHydration();

		await act(async () => {
			await result.current.loadPersistentContextFiles();
		});

		expect(result.current.fileSystem.get("/notes.md")?.content).toEqual([
			"draft",
		]);
		expect(result.current.hasUnsavedPersistentChanges).toBe(true);

		await flushAutosave();

		expect(patchDefaultsMock).toHaveBeenCalledWith({
			files: {
				"/settings.md": {
					content: ["settings"],
					created_at: "2024-01-01T00:00:00Z",
					modified_at: "2024-01-01T00:00:00Z",
				},
				"/notes.md": expect.objectContaining({
					content: ["draft"],
				}),
			},
			deleted_files: ["/legacy-tombstone.md"],
		});
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

	it("autosave waits during streaming and flushes immediately after the stream ends", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.setController(new AbortController());
			result.current.markDirty("/memory/notes.md");
			result.current.updateFile("/memory/notes.md", "streaming change");
		});

		await flushAutosave();

		expect(patchDefaultsMock).not.toHaveBeenCalled();

		await act(async () => {
			result.current.setController(null);
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
				"/memory/notes.md": {
					content: ["streaming change"],
					created_at: "2024-01-02T00:00:00Z",
					modified_at: expect.any(String),
				},
			},
			deleted_files: ["/legacy-tombstone.md"],
		});
	});

	it("manual save is still allowed while streaming", async () => {
		const { result } = renderHook(() => useChatContext(), { wrapper });

		await waitForHydration();

		act(() => {
			result.current.markDirty("/memory/notes.md");
			result.current.updateFile("/memory/notes.md", "streaming change");
			result.current.setController(new AbortController());
		});

		await flushAutosave();

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
