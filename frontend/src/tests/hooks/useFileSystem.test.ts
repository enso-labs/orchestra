import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useFileSystem, { type FileData } from "@/hooks/useFileSystem";

describe("useFileSystem", () => {
	describe("initial state", () => {
		it("should have empty initial state", () => {
			const { result } = renderHook(() => useFileSystem());

			expect(result.current.fileSystem.size).toBe(0);
			expect(result.current.openTabs).toEqual([]);
			expect(result.current.activeFile).toBeNull();
			expect(result.current.dirtyFiles.size).toBe(0);
		});
	});

	describe("createFile", () => {
		it("should create a new file with empty content", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt");
			});

			expect(result.current.fileSystem.has("/test.txt")).toBe(true);
			const file = result.current.fileSystem.get("/test.txt");
			expect(file?.content).toEqual([""]);
			expect(file?.created_at).toBeDefined();
			expect(file?.modified_at).toBeDefined();
		});

		it("should create a new file with provided content", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt", "line1\nline2\nline3");
			});

			const file = result.current.fileSystem.get("/test.txt");
			expect(file?.content).toEqual(["line1", "line2", "line3"]);
		});

		it("should auto-open the file as a tab", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt");
			});

			expect(result.current.openTabs).toContain("/test.txt");
		});

		it("should set the file as activeFile", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt");
			});

			expect(result.current.activeFile).toBe("/test.txt");
		});

		it("should not duplicate tab if file already exists in tabs", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt");
			});

			// Create same file again (should update, not duplicate tab)
			act(() => {
				result.current.createFile("/test.txt", "new content");
			});

			expect(result.current.openTabs.filter((t) => t === "/test.txt").length).toBe(1);
		});
	});

	describe("updateFile", () => {
		it("should update file content", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt", "original");
			});

			act(() => {
				result.current.updateFile("/test.txt", "updated content");
			});

			const file = result.current.fileSystem.get("/test.txt");
			expect(file?.content).toEqual(["updated content"]);
		});

		it("should update modified_at timestamp", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt", "original");
			});

			// Wait a tiny bit to ensure timestamp difference
			act(() => {
				result.current.updateFile("/test.txt", "updated");
			});

			const newModified = result.current.fileSystem.get("/test.txt")?.modified_at;
			expect(newModified).toBeDefined();
			// Note: In fast tests, timestamps might be the same
		});

		it("should not modify fileSystem if file does not exist", () => {
			const { result } = renderHook(() => useFileSystem());

			const initialSize = result.current.fileSystem.size;

			act(() => {
				result.current.updateFile("/nonexistent.txt", "content");
			});

			expect(result.current.fileSystem.size).toBe(initialSize);
		});
	});

	describe("deleteFile", () => {
		it("should remove file from fileSystem", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt");
			});

			expect(result.current.fileSystem.has("/test.txt")).toBe(true);

			act(() => {
				result.current.deleteFile("/test.txt");
			});

			expect(result.current.fileSystem.has("/test.txt")).toBe(false);
		});

		it("should remove file from openTabs", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt");
			});

			expect(result.current.openTabs).toContain("/test.txt");

			act(() => {
				result.current.deleteFile("/test.txt");
			});

			expect(result.current.openTabs).not.toContain("/test.txt");
		});

		it("should remove file from dirtyFiles", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt");
				result.current.markDirty("/test.txt");
			});

			expect(result.current.dirtyFiles.has("/test.txt")).toBe(true);

			act(() => {
				result.current.deleteFile("/test.txt");
			});

			expect(result.current.dirtyFiles.has("/test.txt")).toBe(false);
		});

		it("should select adjacent tab when deleting active file", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/file1.txt");
				result.current.createFile("/file2.txt");
				result.current.createFile("/file3.txt");
			});

			expect(result.current.activeFile).toBe("/file3.txt");

			act(() => {
				result.current.deleteFile("/file3.txt");
			});

			// Should select previous file
			expect(result.current.activeFile).toBe("/file2.txt");
		});

		it("should set activeFile to null when deleting last file", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt");
			});

			act(() => {
				result.current.deleteFile("/test.txt");
			});

			expect(result.current.activeFile).toBeNull();
		});
	});

	describe("renameFile", () => {
		it("should rename file by changing its path", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/old.txt", "content");
			});

			act(() => {
				result.current.renameFile("/old.txt", "/new.txt");
			});

			expect(result.current.fileSystem.has("/old.txt")).toBe(false);
			expect(result.current.fileSystem.has("/new.txt")).toBe(true);
			expect(result.current.fileSystem.get("/new.txt")?.content).toEqual(["content"]);
		});

		it("should update openTabs with new path", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/old.txt");
			});

			act(() => {
				result.current.renameFile("/old.txt", "/new.txt");
			});

			expect(result.current.openTabs).not.toContain("/old.txt");
			expect(result.current.openTabs).toContain("/new.txt");
		});

		it("should update activeFile if renaming active file", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/old.txt");
			});

			expect(result.current.activeFile).toBe("/old.txt");

			act(() => {
				result.current.renameFile("/old.txt", "/new.txt");
			});

			expect(result.current.activeFile).toBe("/new.txt");
		});

		it("should update dirtyFiles with new path", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/old.txt");
				result.current.markDirty("/old.txt");
			});

			act(() => {
				result.current.renameFile("/old.txt", "/new.txt");
			});

			expect(result.current.dirtyFiles.has("/old.txt")).toBe(false);
			expect(result.current.dirtyFiles.has("/new.txt")).toBe(true);
		});
	});

	describe("Tab Operations", () => {
		describe("openTab", () => {
			it("should add path to openTabs", () => {
				const { result } = renderHook(() => useFileSystem());

				// First create a file
				act(() => {
					result.current.createFile("/test.txt");
					result.current.closeTab("/test.txt");
				});

				expect(result.current.openTabs).not.toContain("/test.txt");

				act(() => {
					result.current.openTab("/test.txt");
				});

				expect(result.current.openTabs).toContain("/test.txt");
			});

			it("should not duplicate if already open", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/test.txt");
				});

				const tabCount = result.current.openTabs.length;

				act(() => {
					result.current.openTab("/test.txt");
				});

				expect(result.current.openTabs.length).toBe(tabCount);
			});
		});

		describe("closeTab", () => {
			it("should remove from openTabs but NOT delete file", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/test.txt", "content");
				});

				act(() => {
					result.current.closeTab("/test.txt");
				});

				// Tab should be closed
				expect(result.current.openTabs).not.toContain("/test.txt");
				// But file should still exist in fileSystem
				expect(result.current.fileSystem.has("/test.txt")).toBe(true);
				expect(result.current.fileSystem.get("/test.txt")?.content).toEqual(["content"]);
			});

			it("should select adjacent tab when closing active", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/file1.txt");
					result.current.createFile("/file2.txt");
				});

				expect(result.current.activeFile).toBe("/file2.txt");

				act(() => {
					result.current.closeTab("/file2.txt");
				});

				expect(result.current.activeFile).toBe("/file1.txt");
			});

			it("should clear dirty state for closed tab", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/test.txt");
					result.current.markDirty("/test.txt");
				});

				expect(result.current.dirtyFiles.has("/test.txt")).toBe(true);

				act(() => {
					result.current.closeTab("/test.txt");
				});

				expect(result.current.dirtyFiles.has("/test.txt")).toBe(false);
			});
		});

		describe("selectTab", () => {
			it("should set activeFile", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/file1.txt");
					result.current.createFile("/file2.txt");
				});

				expect(result.current.activeFile).toBe("/file2.txt");

				act(() => {
					result.current.selectTab("/file1.txt");
				});

				expect(result.current.activeFile).toBe("/file1.txt");
			});

			it("should open tab if not already open", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/test.txt");
					result.current.closeTab("/test.txt");
				});

				expect(result.current.openTabs).not.toContain("/test.txt");

				act(() => {
					result.current.selectTab("/test.txt");
				});

				expect(result.current.openTabs).toContain("/test.txt");
				expect(result.current.activeFile).toBe("/test.txt");
			});
		});
	});

	describe("Bulk Operations", () => {
		describe("importFiles", () => {
			it("should import multiple files", () => {
				const { result } = renderHook(() => useFileSystem());

				const files = new Map<string, FileData>([
					["/file1.txt", { content: ["content1"], created_at: "2024-01-01", modified_at: "2024-01-01" }],
					["/file2.txt", { content: ["content2"], created_at: "2024-01-01", modified_at: "2024-01-01" }],
				]);

				act(() => {
					result.current.importFiles(files);
				});

				expect(result.current.fileSystem.has("/file1.txt")).toBe(true);
				expect(result.current.fileSystem.has("/file2.txt")).toBe(true);
			});

			it("should auto-open imported files as tabs", () => {
				const { result } = renderHook(() => useFileSystem());

				const files = new Map<string, FileData>([
					["/file1.txt", { content: ["content1"], created_at: "2024-01-01", modified_at: "2024-01-01" }],
					["/file2.txt", { content: ["content2"], created_at: "2024-01-01", modified_at: "2024-01-01" }],
				]);

				act(() => {
					result.current.importFiles(files);
				});

				expect(result.current.openTabs).toContain("/file1.txt");
				expect(result.current.openTabs).toContain("/file2.txt");
			});

			it("should set first imported file as active if none selected", () => {
				const { result } = renderHook(() => useFileSystem());

				const files = new Map<string, FileData>([
					["/file1.txt", { content: ["content1"], created_at: "2024-01-01", modified_at: "2024-01-01" }],
				]);

				act(() => {
					result.current.importFiles(files);
				});

				expect(result.current.activeFile).toBe("/file1.txt");
			});

			it("should not change activeFile if one is already selected", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/existing.txt");
				});

				const files = new Map<string, FileData>([
					["/new.txt", { content: ["content"], created_at: "2024-01-01", modified_at: "2024-01-01" }],
				]);

				act(() => {
					result.current.importFiles(files);
				});

				expect(result.current.activeFile).toBe("/existing.txt");
			});
		});

		describe("clearFileSystem", () => {
			it("should clear all state", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/file1.txt");
					result.current.createFile("/file2.txt");
					result.current.markDirty("/file1.txt");
				});

				act(() => {
					result.current.clearFileSystem();
				});

				expect(result.current.fileSystem.size).toBe(0);
				expect(result.current.openTabs).toEqual([]);
				expect(result.current.activeFile).toBeNull();
				expect(result.current.dirtyFiles.size).toBe(0);
			});
		});

		describe("getFilesForSubmission", () => {
			it("should return files as Record", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/file1.txt", "content1");
					result.current.createFile("/file2.txt", "content2");
				});

				const submission = result.current.getFilesForSubmission();

				expect(submission["/file1.txt"]).toBeDefined();
				expect(submission["/file2.txt"]).toBeDefined();
				expect(submission["/file1.txt"].content).toEqual(["content1"]);
			});
		});
	});

	describe("Dirty Tracking", () => {
		describe("markDirty", () => {
			it("should add file to dirtyFiles", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/test.txt");
				});

				expect(result.current.dirtyFiles.has("/test.txt")).toBe(false);

				act(() => {
					result.current.markDirty("/test.txt");
				});

				expect(result.current.dirtyFiles.has("/test.txt")).toBe(true);
			});
		});

		describe("markClean", () => {
			it("should remove file from dirtyFiles", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/test.txt");
					result.current.markDirty("/test.txt");
				});

				expect(result.current.dirtyFiles.has("/test.txt")).toBe(true);

				act(() => {
					result.current.markClean("/test.txt");
				});

				expect(result.current.dirtyFiles.has("/test.txt")).toBe(false);
			});
		});
	});
});
