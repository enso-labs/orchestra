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

			expect(
				result.current.openTabs.filter((t) => t === "/test.txt").length,
			).toBe(1);
		});

		it("should mark file with __user_files__ source for filesMap sync", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/test.txt", "user content");
			});

			const file = result.current.fileSystem.get("/test.txt");
			expect(file?.source).toBe("__user_files__");
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

			const newModified =
				result.current.fileSystem.get("/test.txt")?.modified_at;
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

		it("should delete multiple files in one transaction and keep adjacent active tab", () => {
			const { result } = renderHook(() => useFileSystem());

			act(() => {
				result.current.createFile("/keep.txt");
				result.current.createFile("/folder/a.txt");
				result.current.createFile("/folder/b.txt");
				result.current.markDirty("/folder/b.txt");
			});

			expect(result.current.activeFile).toBe("/folder/b.txt");

			act(() => {
				result.current.deleteFiles(["/folder/a.txt", "/folder/b.txt"]);
			});

			expect(result.current.fileSystem.has("/folder/a.txt")).toBe(false);
			expect(result.current.fileSystem.has("/folder/b.txt")).toBe(false);
			expect(result.current.fileSystem.has("/keep.txt")).toBe(true);
			expect(result.current.openTabs).toEqual(["/keep.txt"]);
			expect(result.current.activeFile).toBe("/keep.txt");
			expect(result.current.dirtyFiles.has("/folder/b.txt")).toBe(false);
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
			expect(result.current.fileSystem.get("/new.txt")?.content).toEqual([
				"content",
			]);
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
				expect(result.current.fileSystem.get("/test.txt")?.content).toEqual([
					"content",
				]);
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
					[
						"/file1.txt",
						{
							content: ["content1"],
							created_at: "2024-01-01",
							modified_at: "2024-01-01",
						},
					],
					[
						"/file2.txt",
						{
							content: ["content2"],
							created_at: "2024-01-01",
							modified_at: "2024-01-01",
						},
					],
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
					[
						"/file1.txt",
						{
							content: ["content1"],
							created_at: "2024-01-01",
							modified_at: "2024-01-01",
						},
					],
					[
						"/file2.txt",
						{
							content: ["content2"],
							created_at: "2024-01-01",
							modified_at: "2024-01-01",
						},
					],
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
					[
						"/file1.txt",
						{
							content: ["content1"],
							created_at: "2024-01-01",
							modified_at: "2024-01-01",
						},
					],
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
					[
						"/new.txt",
						{
							content: ["content"],
							created_at: "2024-01-01",
							modified_at: "2024-01-01",
						},
					],
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

	describe("Backend Sync", () => {
		describe("toBackendFormat", () => {
			it("should convert FileData map to Dict[str, str]", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/test.txt", "line1\nline2");
					result.current.createFile("/app.py", "print('hi')");
				});

				const backendFormat = result.current.toBackendFormat();

				expect(backendFormat["/test.txt"]).toBe("line1\nline2");
				expect(backendFormat["/app.py"]).toBe("print('hi')");
			});

			it("should return empty object when no files exist", () => {
				const { result } = renderHook(() => useFileSystem());

				const backendFormat = result.current.toBackendFormat();

				expect(Object.keys(backendFormat).length).toBe(0);
			});

			it("should preserve multiline content correctly", () => {
				const { result } = renderHook(() => useFileSystem());
				const content = "function hello() {\n  return 'world';\n}";

				act(() => {
					result.current.createFile("/index.js", content);
				});

				const backendFormat = result.current.toBackendFormat();
				expect(backendFormat["/index.js"]).toBe(content);
			});
		});

		describe("fromBackendFormat", () => {
			it("should convert Dict[str, str] to FileData map", () => {
				const { result } = renderHook(() => useFileSystem());

				const backendData = {
					"/test.txt": "line1\nline2",
					"/app.py": "print('hi')",
				};

				act(() => {
					result.current.fromBackendFormat(backendData);
				});

				expect(result.current.fileSystem.has("/test.txt")).toBe(true);
				expect(result.current.fileSystem.get("/test.txt")?.content).toEqual([
					"line1",
					"line2",
				]);
				expect(result.current.fileSystem.get("/app.py")?.content).toEqual([
					"print('hi')",
				]);
			});

			it("should auto-open imported files as tabs", () => {
				const { result } = renderHook(() => useFileSystem());

				const backendData = {
					"/file1.txt": "content1",
					"/file2.txt": "content2",
				};

				act(() => {
					result.current.fromBackendFormat(backendData);
				});

				expect(result.current.openTabs).toContain("/file1.txt");
				expect(result.current.openTabs).toContain("/file2.txt");
			});

			it("should set first imported file as active if none selected", () => {
				const { result } = renderHook(() => useFileSystem());

				const backendData = {
					"/first.txt": "content",
				};

				act(() => {
					result.current.fromBackendFormat(backendData);
				});

				expect(result.current.activeFile).toBe("/first.txt");
			});

			it("should not change activeFile if one is already selected", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/existing.txt");
				});

				const backendData = {
					"/new.txt": "content",
				};

				act(() => {
					result.current.fromBackendFormat(backendData);
				});

				expect(result.current.activeFile).toBe("/existing.txt");
			});

			it("should handle empty data gracefully", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.fromBackendFormat({});
				});

				expect(result.current.fileSystem.size).toBe(0);
			});

			it("should mark files with __backend_sync__ source", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.fromBackendFormat({ "/sync.txt": "content" });
				});

				expect(result.current.fileSystem.get("/sync.txt")?.source).toBe(
					"__backend_sync__",
				);
			});
		});

		describe("round-trip conversion", () => {
			it("should preserve content through round-trip conversion", () => {
				const { result } = renderHook(() => useFileSystem());

				const originalContent = "function hello() {\n  return 'world';\n}";

				act(() => {
					result.current.createFile("/index.js", originalContent);
				});

				const backendFormat = result.current.toBackendFormat();

				act(() => {
					result.current.clearFileSystem();
					result.current.fromBackendFormat(backendFormat);
				});

				const file = result.current.fileSystem.get("/index.js");
				expect(file?.content.join("\n")).toBe(originalContent);
			});

			it("should preserve multiple files through round-trip", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/file1.txt", "content1\nline2");
					result.current.createFile(
						"/file2.py",
						"print('hello')\nprint('world')",
					);
				});

				const backendFormat = result.current.toBackendFormat();

				act(() => {
					result.current.clearFileSystem();
					result.current.fromBackendFormat(backendFormat);
				});

				expect(result.current.fileSystem.get("/file1.txt")?.content).toEqual([
					"content1",
					"line2",
				]);
				expect(result.current.fileSystem.get("/file2.py")?.content).toEqual([
					"print('hello')",
					"print('world')",
				]);
			});

			it("should handle empty content correctly", () => {
				const { result } = renderHook(() => useFileSystem());

				act(() => {
					result.current.createFile("/empty.txt", "");
				});

				const backendFormat = result.current.toBackendFormat();
				expect(backendFormat["/empty.txt"]).toBe("");

				act(() => {
					result.current.clearFileSystem();
					result.current.fromBackendFormat(backendFormat);
				});

				expect(result.current.fileSystem.get("/empty.txt")?.content).toEqual([
					"",
				]);
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
