import { useState, useMemo, useEffect } from "react";
import { FileText, Download, Check, Copy, Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import MarkdownCard from "@/components/cards/MarkdownCard";
import JSZip from "jszip";

interface FileEditorPanelProps {
	filesMap: Map<string, any>;
}

export default function FileEditorPanel({ filesMap }: FileEditorPanelProps) {
	const [copied, setCopied] = useState(false);
	const [showPreview, setShowPreview] = useState(false);

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

	// Reset selected file when filesMap changes (new thread loaded)
	useEffect(() => {
		if (fileNames.length > 0) {
			// If current selected file doesn't exist in new files, select first file
			if (!fileNames.includes(selectedFile)) {
				setSelectedFile(fileNames[0]);
				setShowPreview(false);
			}
		}
	}, [fileNames, selectedFile]);

	// Handle file selection change
	const handleFileSelect = (filename: string) => {
		setSelectedFile(filename);
		// Reset preview when switching to a file of different type
		setShowPreview(false);
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
		return Array.isArray(file.content) ? file.content.join("\n") : file.content;
	};

	const isMarkdownFile = (filename: string): boolean => {
		return filename.toLowerCase().endsWith('.md');
	};

	const isHtmlFile = (filename: string): boolean => {
		const lower = filename.toLowerCase();
		return lower.endsWith('.html') || lower.endsWith('.htm');
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
							<button
								key={filename}
								onClick={() => handleFileSelect(filename)}
								className={`
										px-4 py-2 text-sm border-r border-border
										flex items-center gap-2 min-w-fit whitespace-nowrap
										hover:bg-accent transition-colors
										${
											selectedFile === filename
												? "bg-background text-foreground border-b-2 border-b-primary"
												: "text-muted-foreground"
										}
								`}
							>
								<FileText className="h-3 w-3" />
								{filename.split("/").pop()}
							</button>
						))}
					</div>
				</ScrollArea>

				{/* Actions */}
				<div className="flex items-center gap-1 px-2 border-l border-border">
					{/* Preview Toggle (for .md and .html/.htm files) */}
					{selectedFile && (isMarkdownFile(selectedFile) || isHtmlFile(selectedFile)) && (
						<Button
							variant={showPreview ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setShowPreview(!showPreview)}
							className="h-8 gap-2"
							title={showPreview ? "Show code" : `Preview ${isHtmlFile(selectedFile) ? "HTML" : "markdown"}`}
						>
							<Eye className="h-4 w-4" />
						</Button>
					)}

					{/* Copy current file */}
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

					{/* Download current file */}
					<Button
						variant="ghost"
						size="sm"
						onClick={handleDownloadFile}
						className="h-8 gap-2"
						title="Download current file"
					>
						<Download className="h-4 w-4" />
					</Button>

					{/* Download all as ZIP (if multiple files) */}
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
				{selectedFile && allFiles[selectedFile] && (
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
						) : (
							<MonacoEditor
								value={getFileContent(selectedFile)}
								language={getLanguage(selectedFile)}
								readOnly
								height="100%"
								options={{
									minimap: true,
									lineNumbers: true,
									wordWrap: "on",
									fontSize: 13,
								}}
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
}
