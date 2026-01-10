import React, {
	useState,
	useMemo,
	useEffect,
	useCallback,
	useRef,
} from "react";
import {
	FileText,
	Download,
	Check,
	Copy,
	Eye,
	Plus,
	X,
	Folder,
	Mic,
	Square,
	PanelLeft,
} from "lucide-react";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";
import {
	Panel,
	PanelGroup,
	PanelResizeHandle,
} from "react-resizable-panels";
import apiClient from "@/lib/utils/apiClient";
import { MainToolTip } from "../tooltips/MainToolTip";
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
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { FileTreeSidebar } from "./FileTree";

interface BreadcrumbSegment {
	label: string;
	path: string;
	isLast: boolean;
}

export default function FileEditorPanel() {
	// Use new fileSystem with proper tab semantics
	const { 
		fileSystem,
		openTabs,
		activeFile,
		dirtyFiles,
		createFile,
		updateFile,
		deleteFile,
		renameFile: renameFileAction,
		closeTab,
		selectTab,
		markDirty,
		markClean,
		setViewMode,
	} = useChatContext() as {
		fileSystem: Map<string, { content: string[]; created_at: string; modified_at: string; source?: string }>;
		openTabs: string[];
		activeFile: string | null;
		dirtyFiles: Set<string>;
		createFile: (path: string, content?: string) => void;
		updateFile: (path: string, content: string) => void;
		deleteFile: (path: string) => void;
		renameFile: (oldPath: string, newPath: string) => void;
		closeTab: (path: string) => void;
		selectTab: (path: string) => void;
		markDirty: (path: string) => void;
		markClean: (path: string) => void;
		setViewMode: (mode: string) => void;
	};
	
	const [copied, setCopied] = useState(false);
	const [showPreview, setShowPreview] = useState(false);

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

	// Tree sidebar state
	const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);

	// Voice recording state
	const [isRecording, setIsRecording] = useState(false);
	const recorderControls = useVoiceVisualizer();
	const { startRecording, stopRecording, isRecordingInProgress, recordedBlob } =
		recorderControls;

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

	// Get all file paths from fileSystem for validation
	const allFilePaths = useMemo(() => Array.from(fileSystem.keys()), [fileSystem]);
	
	// Use activeFile from context (no local selectedFile state needed)
	const selectedFile = activeFile;

	// Parse selected file path into breadcrumb segments
	const breadcrumbSegments = useMemo((): BreadcrumbSegment[] => {
		if (!selectedFile) return [];

		const parts = selectedFile.replace(/^\//, "").split("/").filter(Boolean);

		return parts.map((part: string, index: number) => ({
			label: part,
			path: "/" + parts.slice(0, index + 1).join("/"),
			isLast: index === parts.length - 1,
		}));
	}, [selectedFile]);

	// Reset preview when switching to non-previewable file
	useEffect(() => {
		if (selectedFile && 
			!isMarkdownFile(selectedFile) && 
			!isHtmlFile(selectedFile) && 
			!isMermaidFile(selectedFile)) {
			setShowPreview(false);
		}
	}, [selectedFile]);

	// Track recording state changes
	useEffect(() => {
		setIsRecording(isRecordingInProgress);
	}, [isRecordingInProgress]);

	// Handle recorded blob - transcribe and insert into editor
	useEffect(() => {
		if (!recordedBlob || !selectedFile) return;

		const formData = new FormData();
		formData.append("file", recordedBlob, "recording.webm");
		formData.append("model", "whisper-large-v3");
		formData.append("response_format", "verbose_json");
		formData.append("temperature", "0.0");
		formData.append("timeout", "30");

		apiClient
			.post("/llm/transcribe", formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			})
			.then((response) => {
				const transcribedText = response.data.transcript.text;
				if (transcribedText && selectedFile) {
					const currentContent = getFileContent(selectedFile);
					const newContent = currentContent
						? `${currentContent}\n${transcribedText}`
						: transcribedText;
					updateFile(selectedFile, newContent);
				}
			})
			.catch((error) => {
				console.error("Error transcribing audio:", error);
			});
	}, [recordedBlob, selectedFile, updateFile]);

	const handleFileSelect = (filename: string) => {
		// Use selectTab which opens the tab if not already open
		selectTab(filename);
	};

	// Voice recording handlers
	const handleStartRecording = () => {
		if (startRecording) {
			startRecording();
		}
	};

	const handleStopRecording = () => {
		if (stopRecording) {
			stopRecording();
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
		const file = fileSystem.get(filename);
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
		if (allFilePaths.includes(path) && path !== excludePath)
			return "File already exists";
		return "";
	};

	const normalizePath = (path: string): string => {
		const trimmed = path.trim();
		if (!trimmed) return "";
		return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
	};

	// Handle content change with debounce
	const handleContentChange = useCallback(
		(value: string | undefined) => {
			if (!selectedFile || value === undefined) return;

			// Mark as dirty immediately
			markDirty(selectedFile);

			// Debounce the actual update
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				updateFile(selectedFile, value);
				// Clear dirty state after save
				markClean(selectedFile);
			}, 300);
		},
		[selectedFile, updateFile, markDirty, markClean],
	);

	// Create new file (createFile auto-opens tab and selects)
	const handleCreateFile = () => {
		const normalizedPath = normalizePath(newFilePath);
		const error = validatePath(normalizedPath);
		if (error) {
			setPathError(error);
			return;
		}
		createFile(normalizedPath, "");
		setShowNewFileDialog(false);
		setNewFilePath("");
		setPathError("");
	};

	// Delete file (deleteFile handles tab closing and selection)
	const handleDeleteFile = () => {
		if (!fileToDelete) return;
		deleteFile(fileToDelete);
		setShowDeleteDialog(false);
		setFileToDelete(null);
		// If this was the last file, reset to chat mode
		if (allFilePaths.length === 1) {
			setViewMode("chat");
		}
	};

	// Start delete flow
	const initiateDelete = (filename: string, e?: React.MouseEvent) => {
		e?.stopPropagation();
		setFileToDelete(filename);
		setShowDeleteDialog(true);
	};

	// Rename file (renameFileAction handles tab and selection update)
	const handleRenameFile = () => {
		if (!fileToRename) return;
		const normalizedPath = normalizePath(renamePath);
		const error = validatePath(normalizedPath, fileToRename);
		if (error) {
			setPathError(error);
			return;
		}
		renameFileAction(fileToRename, normalizedPath);
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
		const normalizedPath = normalizePath(inlineRenamePath);
		const error = validatePath(normalizedPath, inlineRenaming);
		if (!error && normalizedPath !== inlineRenaming) {
			renameFileAction(inlineRenaming, normalizedPath);
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
		allFilePaths.forEach((filename: string) => {
			const content = getFileContent(filename) || "";
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

	// File breadcrumb component
	const FileBreadcrumb = () => {
		if (!selectedFile || breadcrumbSegments.length === 0) return null;

		return (
			<div className="px-3 py-1.5 border-b border-border bg-muted/20">
				<Breadcrumb>
					<BreadcrumbList className="text-xs">
						{/* Root indicator */}
						<BreadcrumbItem>
							<span className="font-mono text-muted-foreground">/</span>
						</BreadcrumbItem>

						{breadcrumbSegments.map((segment) => (
							<React.Fragment key={segment.path}>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									{segment.isLast ? (
										<BreadcrumbPage className="flex items-center gap-1">
											<FileText className="h-3 w-3" />
											<span className="font-medium">{segment.label}</span>
										</BreadcrumbPage>
									) : (
										<span className="flex items-center gap-1 text-muted-foreground">
											<Folder className="h-3 w-3" />
											<span>{segment.label}</span>
										</span>
									)}
								</BreadcrumbItem>
							</React.Fragment>
						))}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
		);
	};

	return (
		<div
			className="h-full flex flex-col bg-background"
			role="main"
			aria-label="File editor"
		>
			<PanelGroup direction="horizontal" className="flex-1">
				{/* Tree Sidebar Panel */}
				<Panel
					defaultSize={20}
					minSize={15}
					maxSize={35}
					collapsible
					collapsedSize={0}
					onCollapse={() => setIsTreeCollapsed(true)}
					onExpand={() => setIsTreeCollapsed(false)}
					className={isTreeCollapsed ? "hidden" : ""}
				>
					<FileTreeSidebar
						selectedFile={selectedFile}
						dirtyFiles={dirtyFiles}
						onFileSelect={handleFileSelect}
						onNewFile={() => setShowNewFileDialog(true)}
						onRename={initiateRename}
						onDelete={(filename) => initiateDelete(filename)}
						isCollapsed={isTreeCollapsed}
						onToggleCollapse={() => setIsTreeCollapsed(!isTreeCollapsed)}
					/>
				</Panel>

				{/* Resize Handle */}
				{!isTreeCollapsed && (
					<PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />
				)}

				{/* Editor Panel */}
				<Panel defaultSize={80}>
					<div className="h-full flex flex-col">
						{/* File Tabs (VSCode-like) */}
						<div className="flex items-center border-b border-border bg-muted/30">
							{/* Toggle tree button when collapsed */}
							{isTreeCollapsed && (
								<MainToolTip content="Show file explorer" delayDuration={300}>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setIsTreeCollapsed(false)}
										className="h-9 px-2 border-r border-border rounded-none"
										aria-label="Show file explorer"
									>
										<PanelLeft className="h-4 w-4" />
									</Button>
								</MainToolTip>
							)}

							<ScrollArea className="flex-1">
								<div className="flex">
									{/* Iterate over openTabs (VSCode-like: only show open tabs) */}
									{openTabs.map((filename: string) => (
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
													{/* Close tab button - CLOSES TAB, does NOT delete file */}
													<button
														onClick={(e) => {
															e.stopPropagation();
															closeTab(filename);
														}}
														className="ml-1 p-1 md:p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
														title="Close tab"
														aria-label={`Close ${filename} tab`}
													>
														<X className="h-4 w-4 md:h-3 md:w-3" />
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
										aria-label="Create new file"
									>
										<Plus className="h-4 w-4" />
									</button>
								</div>
								<ScrollBar orientation="horizontal" />
							</ScrollArea>

							{/* Actions */}
							<div className="flex items-center gap-1 px-2 border-l border-border">
								{/* Dictation button */}
								{selectedFile && (
									<MainToolTip
										content={isRecording ? "Stop dictation" : "Start dictation"}
										delayDuration={500}
									>
										<Button
											variant={isRecording ? "destructive" : "ghost"}
											size="sm"
											onClick={
												isRecording ? handleStopRecording : handleStartRecording
											}
											className="h-8 gap-2"
											aria-label={isRecording ? "Stop dictation" : "Start dictation"}
										>
											{isRecording ? (
												<Square className="h-4 w-4" />
											) : (
												<Mic className="h-4 w-4" />
											)}
										</Button>
									</MainToolTip>
								)}

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
											aria-label={
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
									aria-label="Copy file content to clipboard"
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
									aria-label="Download current file"
								>
									<Download className="h-4 w-4" />
								</Button>

								{allFilePaths.length > 1 && (
									<Button
										variant="ghost"
										size="sm"
										onClick={handleDownloadAllAsZip}
										className="h-8 gap-2 text-xs"
										title="Download all as ZIP"
										aria-label="Download all files as ZIP"
									>
										<Download className="h-4 w-4" />
										All
									</Button>
								)}
							</div>
						</div>

						{/* File Path Breadcrumb */}
						<FileBreadcrumb />

						{/* Voice Visualizer - only show when recording */}
						{isRecording && (
							<div className="px-4 py-2 bg-background border-b border-border">
								<VoiceVisualizer
									controls={recorderControls}
									height={35}
									width="100%"
									isControlPanelShown={false}
									isDefaultUIShown={false}
									onlyRecording={true}
									speed={1}
									barWidth={2}
								/>
							</div>
						)}

						{/* Editor Area */}
						<div className="flex-1 overflow-hidden">
							{selectedFile && fileSystem.has(selectedFile) ? (
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
							) : allFilePaths.length === 0 ? (
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
					</div>
				</Panel>
			</PanelGroup>

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
