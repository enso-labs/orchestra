import React from "react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileTreeNode } from "@/components/panels/FileTree/FileTreeNode";
import { FileTreeSidebar } from "@/components/panels/FileTree/FileTreeSidebar";

const mockContext = {
	fileSystem: new Map<string, any>(),
};

vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => mockContext,
}));

vi.mock("@/components/panels/FileTree/FileTreeHeader", () => ({
	FileTreeHeader: () => <div data-testid="tree-header" />,
}));

vi.mock("@/components/panels/FileTree/FileTreeSearch", () => ({
	FileTreeSearch: React.forwardRef(() => <div data-testid="tree-search" />),
}));

vi.mock("@/components/ui/scroll-area", () => ({
	ScrollArea: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button onClick={onClick}>{children}</button>
	),
}));

vi.mock("@/components/ui/context-menu", () => ({
	ContextMenu: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	ContextMenuContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	ContextMenuItem: ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => <button onClick={onClick}>{children}</button>,
	ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock("lucide-react", () => {
	const Icon = () => <span />;
	return {
		FileText: Icon,
		Folder: Icon,
		FolderOpen: Icon,
		ChevronRight: Icon,
		FolderPlus: Icon,
		SearchX: Icon,
	};
});

describe("FileTreeSidebar", () => {
	beforeEach(() => {
		mockContext.fileSystem = new Map([
			[
				"/memory/notes.md",
				{
					content: ["notes"],
					created_at: "2024-01-01T00:00:00Z",
					modified_at: "2024-01-01T00:00:00Z",
				},
			],
		]);
	});

	it("keeps Delete and removes Rename for folder nodes", () => {
		render(
			<FileTreeNode
				item={{
					index: "/memory",
					data: {
						name: "memory",
						path: "/memory",
						isFolder: true,
					},
					isFolder: true,
					children: ["/memory/notes.md"],
				}}
				depth={0}
				isSelected={false}
				isDirty={false}
				isExpanded={true}
				onSelect={vi.fn()}
				onToggle={vi.fn()}
				onRename={vi.fn()}
				onDelete={vi.fn()}
				onNewFile={vi.fn()}
			/>,
		);

		expect(screen.getByText("Delete")).toBeInTheDocument();
		expect(screen.queryByText("Rename")).not.toBeInTheDocument();
	});

	it("updates the rendered tree immediately when folder files disappear", () => {
		const { rerender } = render(
			<FileTreeSidebar
				selectedFile={null}
				dirtyFiles={new Set()}
				onFileSelect={vi.fn()}
				onNewFile={vi.fn()}
				onRename={vi.fn()}
				onDelete={vi.fn()}
			/>,
		);

		expect(screen.getByText("memory")).toBeInTheDocument();

		mockContext.fileSystem = new Map();
		rerender(
			<FileTreeSidebar
				selectedFile={null}
				dirtyFiles={new Set()}
				onFileSelect={vi.fn()}
				onNewFile={vi.fn()}
				onRename={vi.fn()}
				onDelete={vi.fn()}
			/>,
		);

		expect(screen.queryByText("memory")).not.toBeInTheDocument();
	});
});
