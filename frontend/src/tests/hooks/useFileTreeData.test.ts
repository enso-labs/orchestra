import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
	useFileTreeData,
	buildTreeFromPaths,
	getEmptyTree,
} from "@/hooks/useFileTreeData";
import type { FileData } from "@/hooks/useFileSystem";

describe("useFileTreeData", () => {
	describe("getEmptyTree", () => {
		it("should return tree with only root node", () => {
			const tree = getEmptyTree();

			expect(tree.root).toBeDefined();
			expect(tree.root.index).toBe("root");
			expect(tree.root.isFolder).toBe(true);
			expect(tree.root.children).toEqual([]);
			expect(tree.root.data.name).toBe("Files");
			expect(tree.root.data.path).toBe("/");
		});
	});

	describe("buildTreeFromPaths", () => {
		it("should return empty tree for empty fileSystem", () => {
			const fileSystem = new Map<string, FileData>();
			const tree = buildTreeFromPaths(fileSystem);

			expect(tree.root).toBeDefined();
			expect(tree.root.children).toEqual([]);
		});

		it("should build tree for single file at root", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"/test.txt",
					{
						content: ["content"],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const tree = buildTreeFromPaths(fileSystem);

			expect(tree.root.children).toContain("/test.txt");
			expect(tree["/test.txt"]).toBeDefined();
			expect(tree["/test.txt"].isFolder).toBe(false);
			expect(tree["/test.txt"].data.name).toBe("test.txt");
			expect(tree["/test.txt"].data.path).toBe("/test.txt");
		});

		it("should build tree for nested file structure", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"/src/components/Button.tsx",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const tree = buildTreeFromPaths(fileSystem);

			// Root should have /src
			expect(tree.root.children).toContain("/src");

			// /src should be a folder with /src/components
			expect(tree["/src"]).toBeDefined();
			expect(tree["/src"].isFolder).toBe(true);
			expect(tree["/src"].children).toContain("/src/components");

			// /src/components should be a folder with the file
			expect(tree["/src/components"]).toBeDefined();
			expect(tree["/src/components"].isFolder).toBe(true);
			expect(tree["/src/components"].children).toContain(
				"/src/components/Button.tsx",
			);

			// The file should exist
			expect(tree["/src/components/Button.tsx"]).toBeDefined();
			expect(tree["/src/components/Button.tsx"].isFolder).toBe(false);
			expect(tree["/src/components/Button.tsx"].data.name).toBe("Button.tsx");
		});

		it("should sort folders before files", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"/aaa.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
				[
					"/zzz/file.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
				[
					"/bbb.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const tree = buildTreeFromPaths(fileSystem);

			// Folder /zzz should come before files
			const rootChildren = tree.root.children || [];
			const zzzIndex = rootChildren.indexOf("/zzz");
			const aaaIndex = rootChildren.indexOf("/aaa.txt");
			const bbbIndex = rootChildren.indexOf("/bbb.txt");

			expect(zzzIndex).toBeLessThan(aaaIndex);
			expect(zzzIndex).toBeLessThan(bbbIndex);
		});

		it("should sort items alphabetically within same type", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"/zebra.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
				[
					"/apple.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
				[
					"/mango.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const tree = buildTreeFromPaths(fileSystem);

			const rootChildren = tree.root.children;
			expect(rootChildren).toEqual(["/apple.txt", "/mango.txt", "/zebra.txt"]);
		});

		it("should handle multiple files in same directory", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"/src/index.ts",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
				[
					"/src/utils.ts",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
				[
					"/src/types.ts",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const tree = buildTreeFromPaths(fileSystem);

			expect(tree["/src"].children).toHaveLength(3);
			expect(tree["/src"].children).toContain("/src/index.ts");
			expect(tree["/src"].children).toContain("/src/utils.ts");
			expect(tree["/src"].children).toContain("/src/types.ts");
		});

		it("should skip dangerous path segments", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"/../../../etc/passwd",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const tree = buildTreeFromPaths(fileSystem);

			// Dangerous paths with directory traversal segments should be rejected/ignored
			expect(tree["/../../../etc/passwd"]).toBeUndefined();
		});

		it("should handle paths without leading slash", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"test.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const tree = buildTreeFromPaths(fileSystem);

			// Should normalize to have leading slash
			expect(tree["/test.txt"]).toBeDefined();
		});
	});

	describe("useFileTreeData hook", () => {
		it("should return isEmpty true for empty fileSystem", () => {
			const fileSystem = new Map<string, FileData>();
			const { result } = renderHook(() => useFileTreeData(fileSystem));

			expect(result.current.isEmpty).toBe(true);
		});

		it("should return isEmpty false when files exist", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"/test.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const { result } = renderHook(() => useFileTreeData(fileSystem));

			expect(result.current.isEmpty).toBe(false);
		});

		it("should memoize tree items", () => {
			const fileSystem = new Map<string, FileData>([
				[
					"/test.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const { result, rerender } = renderHook(() =>
				useFileTreeData(fileSystem),
			);

			const firstItems = result.current.items;

			rerender();

			const secondItems = result.current.items;

			// Should be the same reference (memoized)
			expect(firstItems).toBe(secondItems);
		});

		it("should rebuild tree when fileSystem changes", () => {
			let fileSystem = new Map<string, FileData>([
				[
					"/test.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			const { result, rerender } = renderHook(({ fs }) => useFileTreeData(fs), {
				initialProps: { fs: fileSystem },
			});

			const firstItems = result.current.items;
			expect(firstItems["/test.txt"]).toBeDefined();

			// Create new fileSystem with different file
			fileSystem = new Map<string, FileData>([
				[
					"/other.txt",
					{
						content: [""],
						created_at: "2024-01-01",
						modified_at: "2024-01-01",
					},
				],
			]);

			rerender({ fs: fileSystem });

			const secondItems = result.current.items;
			expect(secondItems["/other.txt"]).toBeDefined();
			expect(secondItems["/test.txt"]).toBeUndefined();
		});
	});
});
