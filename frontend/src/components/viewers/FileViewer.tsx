import { useState } from "react";
import { FileText, Copy } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import MonacoEditor from "@/components/inputs/MonacoEditor";

interface FileViewerProps {
	files: Record<
		string,
		{
			content: string[];
			created_at: string;
			modified_at: string;
		}
	>;
}

export default function FileViewer({ files }: FileViewerProps) {
	const fileNames = Object.keys(files);
	const [selectedFile, setSelectedFile] = useState<string>(fileNames[0]);

	// Get file extension for language detection
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
			scss: "scss",
			sass: "sass",
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
			dart: "dart",
			r: "r",
		};
		return langMap[ext || ""] || "plaintext";
	};

	// Convert content array to string
	const getFileContent = (file: { content: string[] }): string => {
		return Array.isArray(file.content) ? file.content.join("\n") : file.content;
	};

	// Get display name (last part of path)
	const getDisplayName = (filename: string): string => {
		return filename.split("/").pop() || filename;
	};

	// Copy to clipboard
	const handleCopy = async (content: string) => {
		try {
			await navigator.clipboard.writeText(content);
		} catch (error) {
			console.error("Failed to copy:", error);
		}
	};

	if (!files || fileNames.length === 0) {
		return null;
	}

	return (
		<Accordion type="single" collapsible className="w-full">
			<AccordionItem value="files" className="border-border">
				<AccordionTrigger className="hover:no-underline">
					<div className="flex items-center gap-2">
						<FileText className="h-4 w-4 text-primary" />
						<span className="text-sm font-medium">
							Files Created ({fileNames.length})
						</span>
					</div>
				</AccordionTrigger>
				<AccordionContent>
					{fileNames.length === 1 ? (
						// Single file - no tabs needed
						<div className="space-y-2">
							<div className="flex justify-between items-center px-2">
								<span className="text-xs text-muted-foreground font-mono">
									{fileNames[0]}
								</span>
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										handleCopy(getFileContent(files[fileNames[0]]))
									}
									className="h-7 text-xs"
								>
									<Copy className="h-3 w-3 mr-1" />
									Copy
								</Button>
							</div>

							<div className="border border-border rounded-md overflow-hidden">
								<MonacoEditor
									value={getFileContent(files[fileNames[0]])}
									language={getLanguage(fileNames[0])}
									readOnly={true}
									height="400px"
									options={{
										minimap: false,
										lineNumbers: true,
										wordWrap: "on",
										fontSize: 12,
									}}
								/>
							</div>

							<div className="text-xs text-muted-foreground px-2">
								Created: {new Date(files[fileNames[0]].created_at).toLocaleString()}
							</div>
						</div>
					) : (
						// Multiple files - use tabs
						<Tabs value={selectedFile} onValueChange={setSelectedFile}>
							<TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
								{fileNames.map((filename) => (
									<TabsTrigger
										key={filename}
										value={filename}
										className="text-xs"
									>
										{getDisplayName(filename)}
									</TabsTrigger>
								))}
							</TabsList>

							{fileNames.map((filename) => (
								<TabsContent key={filename} value={filename} className="mt-2">
									<div className="space-y-2">
										<div className="flex justify-between items-center px-2">
											<span className="text-xs text-muted-foreground font-mono">
												{filename}
											</span>
											<Button
												size="sm"
												variant="outline"
												onClick={() => handleCopy(getFileContent(files[filename]))}
												className="h-7 text-xs"
											>
												<Copy className="h-3 w-3 mr-1" />
												Copy
											</Button>
										</div>

										<div className="border border-border rounded-md overflow-hidden">
											<MonacoEditor
												value={getFileContent(files[filename])}
												language={getLanguage(filename)}
												readOnly={true}
												height="400px"
												options={{
													minimap: false,
													lineNumbers: true,
													wordWrap: "on",
													fontSize: 12,
												}}
											/>
										</div>

										<div className="text-xs text-muted-foreground px-2">
											Created: {new Date(files[filename].created_at).toLocaleString()}
										</div>
									</div>
								</TabsContent>
							))}
						</Tabs>
					)}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

