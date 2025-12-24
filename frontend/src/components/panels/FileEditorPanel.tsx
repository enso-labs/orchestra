import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { FileText, Download, Check, Copy, Eye, Plus, X } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import MarkdownCard from "@/components/cards/MarkdownCard";
import JSZip from "jszip";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { useChatContext } from "@/context/ChatContext";

interface FileEditorPanelProps {
	filesMap: Map<string, any>;
}

export default function FileEditorPanel({ filesMap }: FileEditorPanelProps) {
	const { addFile, updateFileContent, removeFile, renameFile, setViewMode } =
		useChatContext();
	const [copied, setCopied] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());

	// Dialog states
	const [showNewFileDialog, setShowNewFileDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showRenameDialog, setShowRenameDialog] = useState(false);
	const [newFilePath, setNewFilePath] = useState("");
	const [fileToDelete, setFileToDelete] = useState<string | null>(null);
	const [fileToRename, setFileToRename] = useState<string | null>(null);
	const [renamePath, setRenamePath] = useState("");
	const [pathError, setPathError] = useState("");

	// Rename input ref for inline editing
	const renameInputRef = useRef<HTMLInputElement>(null);
	const [inlineRenaming, setInlineRenaming] = useState<string | null>(null);
	const [inlineRenamePath, setInlineRenamePath] = useState("");

	// Debounce timer ref
	const debounceRef = useRef<NodeJS.Timeout | null>(null);

	// Memoized Monaco options to prevent re-initialization
	const monacoOptions = useMemo(
		() => ({
			minimap: true,
			lineNumbers: "on" as const,
			wordWrap: "on" as const,
			fontSize: 13,
		}),
		[],
	);

	// Flatten all files from all messages
	const allFiles = useMemo(() => {
		const files: Record<string, any> = {};
		filesMap.forEach((messageFiles) => {
			Object.assign(files, messageFiles);
		});
		return files;
	}, [filesMap]);

	const fileNames = Object.keys(allFiles);
	const [selectedFile, setSelectedFile] = useState(fileNames[0]);

	// Reset selected file when filesMap changes
	useEffect(() => {
		if (fileNames.length > 0) {
			if (!fileNames.includes(selectedFile)) {
				const firstFile = fileNames[0];
				setSelectedFile(firstFile);
				if (
					!isMarkdownFile(firstFile) &&
					!isHtmlFile(firstFile) &&
					!isMermaidFile(firstFile)
				) {
					setShowPreview(false);
				}
			}
		}
	}, [fileNames, selectedFile]);

	const handleFileSelect = (filename: string) => {
		setSelectedFile(filename);
		if (
			!isMarkdownFile(filename) &&
			!isHtmlFile(filename) &&
			!isMermaidFile(filename)
		) {
			setShowPreview(false);
		}
	};

	const getLanguage = (filename: string): string => {
		const ext = filename.split(".").pop()?.toLowerCase();
		const langMap: Record<string, string> = {
			js: "javascript",
			ts: "typescript",
			tsx: "typescript",
			jsx: "javascript",
			py: "python",
			md: "markdown",
			json: "json",
			html: "html",
			css: "css",
			sh: "shell",
			bash: "shell",
			yml: "yaml",
			yaml: "yaml",
			xml: "xml",
			sql: "sql",
			go: "go",
			rs: "rust",
			java: "java",
			c: "c",
			cpp: "cpp",
			cs: "csharp",
			php: "php",
			rb: "ruby",
			swift: "swift",
			kt: "kotlin",
		};
		return langMap[ext || ""] || "plaintext";
	};

	const getFileContent = (filename: string): string => {
		const file = allFiles[filename];
		if (!file) return "";
		return Array.isArray(file.content) ? file.content.join("\n") : file.content;
	};

	const isMarkdownFile = (filename: string): boolean => {
		return filename.toLowerCase().endsWith(".md");
	};

	const isHtmlFile = (filename: string): boolean => {
		const lower = filename.toLowerCase();
		return lower.endsWith(".html") || lower.endsWith(".htm");
	};

	const isMermaidFile = (filename: string): boolean => {
		return filename.toLowerCase().endsWith(".mmd");
	};

	// Validate file path
	const validatePath = (path: string, excludePath?: string): string => {
		if (!path.trim()) return "Path is required";
		if (!path.startsWith("/")) return "Path must start with /";
		if (!/^\/[a-zA-Z0-9_\-./]+$/.test(path))
			return "Invalid characters in path";
		if (fileNames.includes(path) && path !== excludePath)
			return "File already exists";
		return "";
	};

	// Handle content change with debounce
	const handleContentChange = useCallback(
		(value: string | undefined) => {
			if (!selectedFile || value === undefined) return;

			// Mark as dirty immediately
			setDirtyFiles((prev) => new Set(prev).add(selectedFile));

			// Debounce the actual update
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				updateFileContent(selectedFile, value);
				// Clear dirty state after save
				setDirtyFiles((prev) => {
					const next = new Set(prev);
					next.delete(selectedFile);
					return next;
				});
			}, 300);
		},
		[selectedFile, updateFileContent],
	);

	// Create new file
	const handleCreateFile = () => {
		const error = validatePath(newFilePath);
		if (error) {
			setPathError(error);
			return;
		}
		addFile(newFilePath, "");
		setSelectedFile(newFilePath);
		setShowNewFileDialog(false);
		setNewFilePath("");
		setPathError("");
	};

	// Delete file
	const handleDeleteFile = () => {
		if (!fileToDelete) return;
		removeFile(fileToDelete);
		setShowDeleteDialog(false);
		setFileToDelete(null);
		// If this was the last file, reset to chat mode
		if (fileNames.length === 1) {
			setViewMode("chat");
			return;
		}
		// Select adjacent file
		const idx = fileNames.indexOf(fileToDelete);
		const nextFile = fileNames[idx + 1] || fileNames[idx - 1];
		if (nextFile) setSelectedFile(nextFile);
	};

	// Start delete flow
	const initiateDelete = (filename: string, e?: React.MouseEvent) => {
		e?.stopPropagation();
		setFileToDelete(filename);
		setShowDeleteDialog(true);
	};

	// Rename file
	const handleRenameFile = () => {
		if (!fileToRename) return;
		const error = validatePath(renamePath, fileToRename);
		if (error) {
			setPathError(error);
			return;
		}
		renameFile(fileToRename, renamePath);
		setSelectedFile(renamePath);
		setShowRenameDialog(false);
		setFileToRename(null);
		setRenamePath("");
		setPathError("");
	};

	// Start rename flow (context menu)
	const initiateRename = (filename: string) => {
		setFileToRename(filename);
		setRenamePath(filename);
		setShowRenameDialog(true);
	};

	// Inline rename on double-click
	const handleDoubleClick = (filename: string) => {
		setInlineRenaming(filename);
		setInlineRenamePath(filename);
		setTimeout(() => renameInputRef.current?.select(), 0);
	};

	const handleInlineRenameSubmit = () => {
		if (!inlineRenaming) return;
		const error = validatePath(inlineRenamePath, inlineRenaming);
		if (!error && inlineRenamePath !== inlineRenaming) {
			renameFile(inlineRenaming, inlineRenamePath);
			setSelectedFile(inlineRenamePath);
		}
		setInlineRenaming(null);
		setInlineRenamePath("");
	};

	const handleInlineRenameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleInlineRenameSubmit();
		} else if (e.key === "Escape") {
			setInlineRenaming(null);
			setInlineRenamePath("");
		}
	};

	// Copy current file content
	const handleCopy = async () => {
		if (!selectedFile) return;
		try {
			await navigator.clipboard.writeText(getFileContent(selectedFile));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	// Download single file
	const handleDownloadFile = () => {
		if (!selectedFile) return;
		const content = getFileContent(selectedFile);
		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = selectedFile.split("/").pop() || selectedFile;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	// Download all files as ZIP
	const handleDownloadAllAsZip = async () => {
		const zip = new JSZip();
		fileNames.forEach((filename) => {
			const content = getFileContent(filename);
			zip.file(filename, content);
		});
		try {
			const blob = await zip.generateAsync({ type: "blob" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `files-${Date.now()}.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Failed to create ZIP:", err);
		}
	};

	return (
		<div className="h-full flex flex-col bg-background">
			{/* File Tabs (VSCode-like) */}
			<div className="flex items-center border-b border-border bg-muted/30">
				<ScrollArea className="flex-1">
					<div className="flex">
						{fileNames.map((filename) => (
							<ContextMenu key={filename}>
								<ContextMenuTrigger asChild>
									<button
										onClick={() => handleFileSelect(filename)}
										onDoubleClick={() => handleDoubleClick(filename)}
										className={`
											px-3 py-2 text-sm border-r border-border
											flex items-center gap-1.5 min-w-fit whitespace-nowrap
											hover:bg-accent transition-colors group relative
											${
												selectedFile === filename
													? "bg-background text-foreground border-b-2 border-b-primary"
													: "text-muted-foreground"
											}
										`}
									>
										<FileText className="h-3 w-3 flex-shrink-0" />
										{inlineRenaming === filename ? (
											<input
												ref={renameInputRef}
												value={inlineRenamePath}
												onChange={(e) => setInlineRenamePath(e.target.value)}
												onBlur={handleInlineRenameSubmit}
												onKeyDown={handleInlineRenameKeyDown}
												onClick={(e) => e.stopPropagation()}
												className="bg-transparent border border-primary rounded px-1 text-sm w-32 focus:outline-none"
											/>
										) : (
											<>
												{dirtyFiles.has(filename) && (
													<span className="text-primary text-xs">•</span>
												)}
												<span>{filename.split("/").pop()}</span>
											</>
										)}
										{/* Close button */}
										<button
											onClick={(e) => initiateDelete(filename, e)}
											className="ml-1 p-0.5 rounded hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity"
											title="Close file"
										>
											<X className="h-3 w-3 hover:text-destructive" />
										</button>
									</button>
								</ContextMenuTrigger>
								<ContextMenuContent>
									<ContextMenuItem onClick={() => initiateRename(filename)}>
										Rename
									</ContextMenuItem>
									<ContextMenuItem
										onClick={() => initiateDelete(filename)}
										className="text-destructive"
									>
										Delete
									</ContextMenuItem>
								</ContextMenuContent>
							</ContextMenu>
						))}
						{/* New File Button */}
						<button
							onClick={() => setShowNewFileDialog(true)}
							className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							title="New File"
						>
							<Plus className="h-4 w-4" />
						</button>
					</div>
					<ScrollBar orientation="horizontal" />
				</ScrollArea>

				{/* Actions */}
				<div className="flex items-center gap-1 px-2 border-l border-border">
					{selectedFile &&
						(isMarkdownFile(selectedFile) ||
							isHtmlFile(selectedFile) ||
							isMermaidFile(selectedFile)) && (
							<Button
								variant={showPreview ? "secondary" : "ghost"}
								size="sm"
								onClick={() => setShowPreview(!showPreview)}
								className="h-8 gap-2"
								title={
									showPreview
										? "Show code"
										: `Preview ${isHtmlFile(selectedFile) ? "HTML" : isMermaidFile(selectedFile) ? "Mermaid diagram" : "markdown"}`
								}
							>
								<Eye className="h-4 w-4" />
							</Button>
						)}

					<Button
						variant="ghost"
						size="sm"
						onClick={handleCopy}
						className="h-8 gap-2"
						title="Copy current file"
					>
						{copied ? (
							<Check className="h-4 w-4 text-green-500" />
						) : (
							<Copy className="h-4 w-4" />
						)}
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={handleDownloadFile}
						className="h-8 gap-2"
						title="Download current file"
					>
						<Download className="h-4 w-4" />
					</Button>

					{fileNames.length > 1 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleDownloadAllAsZip}
							className="h-8 gap-2 text-xs"
							title="Download all as ZIP"
						>
							<Download className="h-4 w-4" />
							All
						</Button>
					)}
				</div>
			</div>

			{/* Editor Area */}
			<div className="flex-1 overflow-hidden">
				{selectedFile && allFiles[selectedFile] ? (
					<>
						{showPreview && isMarkdownFile(selectedFile) ? (
							<ScrollArea className="h-full">
								<div className="p-6 max-w-4xl mx-auto">
									<MarkdownCard content={getFileContent(selectedFile)} />
								</div>
							</ScrollArea>
						) : showPreview && isHtmlFile(selectedFile) ? (
							<iframe
								srcDoc={getFileContent(selectedFile)}
								sandbox="allow-same-origin"
								className="w-full h-full border-0 bg-white"
								title={`Preview of ${selectedFile}`}
							/>
						) : showPreview && isMermaidFile(selectedFile) ? (
							<ScrollArea className="h-full">
								<div className="p-6 max-w-4xl mx-auto">
									<MarkdownCard
										content={`\`\`\`mermaid\n${getFileContent(selectedFile)}\n\`\`\``}
									/>
								</div>
							</ScrollArea>
						) : (
							<MonacoEditor
								key={selectedFile}
								value={getFileContent(selectedFile)}
								language={getLanguage(selectedFile)}
								handleChange={handleContentChange}
								height="100%"
								options={monacoOptions}
							/>
						)}
					</>
				) : fileNames.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
						<FileText className="h-12 w-12 opacity-50" />
						<p>No files yet</p>
						<Button
							variant="outline"
							onClick={() => setShowNewFileDialog(true)}
							className="gap-2"
						>
							<Plus className="h-4 w-4" />
							Create File
						</Button>
					</div>
				) : null}
			</div>

			{/* New File Dialog */}
			<Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New File</DialogTitle>
					</DialogHeader>
					<div className="py-4">
						<Input
							placeholder="/path/to/file.ext"
							value={newFilePath}
							onChange={(e) => {
								setNewFilePath(e.target.value);
								setPathError("");
							}}
							onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
							autoFocus
						/>
						{pathError && (
							<p className="text-sm text-destructive mt-2">{pathError}</p>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => {
								setShowNewFileDialog(false);
								setNewFilePath("");
								setPathError("");
							}}
						>
							Cancel
						</Button>
						<Button onClick={handleCreateFile}>Create</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete File</DialogTitle>
					</DialogHeader>
					<p className="py-4">
						Are you sure you want to delete{" "}
						<span className="font-mono text-sm bg-muted px-1 rounded">
							{fileToDelete}
						</span>
						?
						{fileToDelete && dirtyFiles.has(fileToDelete) && (
							<span className="block mt-2 text-sm text-amber-500">
								This file has unsaved changes.
							</span>
						)}
					</p>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => {
								setShowDeleteDialog(false);
								setFileToDelete(null);
							}}
						>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteFile}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Rename Dialog */}
			<Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rename File</DialogTitle>
					</DialogHeader>
					<div className="py-4">
						<Input
							placeholder="/path/to/file.ext"
							value={renamePath}
							onChange={(e) => {
								setRenamePath(e.target.value);
								setPathError("");
							}}
							onKeyDown={(e) => e.key === "Enter" && handleRenameFile()}
							autoFocus
						/>
						{pathError && (
							<p className="text-sm text-destructive mt-2">{pathError}</p>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => {
								setShowRenameDialog(false);
								setFileToRename(null);
								setRenamePath("");
								setPathError("");
							}}
						>
							Cancel
						</Button>
						<Button onClick={handleRenameFile}>Rename</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
