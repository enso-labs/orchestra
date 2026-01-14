import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ShieldCheck, ShieldOff, Globe } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import ImageUpload from "../inputs/ImageUpload";

const DEFAULT_AGENT_TOOLS = [
	"web_search",
	"web_scrape",
	"math_calculator",
	"think_tool",
	// "python_sandbox",
];

export function BaseToolMenu() {
	const {
		agent,
		setAgent,
		webSearchCheck,
		setWebSearchCheck,
		piiAnalyzeCheck,
		setPiiAnalyzeCheck,
		piiAnonymizeCheck,
		setPiiAnonymizeCheck,
	} = useAgentContext();
	const { addFile, setViewMode } = useChatContext();
	const [open, setOpen] = useState<boolean>(false);
	const [showFileDialog, setShowFileDialog] = useState(false);
	const [newFilePath, setNewFilePath] = useState("");
	const [pathError, setPathError] = useState("");

	// Validate file path
	const validatePath = (path: string): string => {
		if (!path.trim()) return "Path is required";
		if (!path.startsWith("/")) return "Path must start with /";
		if (!/^\/[a-zA-Z0-9_\-./]+$/.test(path))
			return "Invalid characters in path";
		return "";
	};

	const handleCreateFile = () => {
		const trimmedPath = newFilePath.trim();
		const normalizedPath = trimmedPath.startsWith("/")
			? trimmedPath
			: `/${trimmedPath}`;
		const error = validatePath(normalizedPath);
		if (error) {
			setPathError(error);
			return;
		}
		addFile(normalizedPath, "");
		setViewMode("editor");
		setShowFileDialog(false);
		setNewFilePath("");
		setPathError("");
		setOpen(false);
	};

	useEffect(() => {
		setAgent({ ...agent, tools: [...agent.tools, ...DEFAULT_AGENT_TOOLS] });
	}, []);

	useEffect(() => {
		localStorage.setItem("enso:tool:search", JSON.stringify(webSearchCheck));
		if (webSearchCheck) {
			setAgent({
				...agent,
				tools: [...new Set([...agent.tools, ...DEFAULT_AGENT_TOOLS])],
			});
		} else {
			setAgent({
				...agent,
				tools: agent.tools.filter(
					(tool: string) => !DEFAULT_AGENT_TOOLS.includes(tool),
				),
			});
		}
	}, [webSearchCheck]);

	return (
		<>
			<DropdownMenu open={open}>
				<DropdownMenuTrigger asChild>
					<Button
						onClick={() => setOpen(!open)}
						size="icon"
						variant="outline"
						className="rounded-full ml-1 bg-foreground/10 text-foreground-500 cursor-pointer"
					>
						<Plus className="h-5 w-5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					className="w-64 rounded-xl"
					align="start"
					onInteractOutside={() => setOpen(false)}
					onEscapeKeyDown={() => setOpen(false)}
				>
					<DropdownMenuGroup>
						<ImageUpload />
						{/* TODO: This has a bug when clicked where FREEZES interface 
						https://github.com/ruska-ai/orchestra/pull/620#pullrequestreview-3614465679 
						
						<DropdownMenuItem
							onClick={() => setShowFileDialog(true)}
							className="flex items-center gap-3 cursor-pointer text-base rounded-lg"
						>
							<FileCode className="h-4 w-4" />
							<span>Add File</span>
						</DropdownMenuItem> */}
						<DropdownMenuSeparator className="h-px bg-muted-foreground/30" />
						<DropdownMenuItem
							onClick={() => setWebSearchCheck(!webSearchCheck)}
							className="flex items-center gap-3 cursor-pointer text-base rounded-lg"
						>
							<Globe className="h-12 w-12" />
							<span>Web Search {webSearchCheck ? "✅" : "🚫"}</span>
						</DropdownMenuItem>
						{localStorage.getItem("enso:checkbox:pii_analyze") && (
							<DropdownMenuItem
								onClick={() => setPiiAnalyzeCheck(!piiAnalyzeCheck)}
								className="flex items-center gap-3 cursor-pointer text-base rounded-lg"
							>
								{piiAnalyzeCheck ? (
									<ShieldCheck className="h-15 w-15 text-green-500" />
								) : (
									<ShieldOff className="h-15 w-15 text-red-500" />
								)}
								<span>
									PII Analayze {piiAnalyzeCheck ? "(Enabled)" : "(Disabled)"}
								</span>
							</DropdownMenuItem>
						)}
						{localStorage.getItem("enso:checkbox:pii_anonymize") && (
							<DropdownMenuItem
								onClick={() => setPiiAnonymizeCheck(!piiAnonymizeCheck)}
								className="flex items-center gap-3 cursor-pointer text-base rounded-lg"
							>
								{piiAnonymizeCheck ? (
									<ShieldCheck className="h-15 w-15 text-green-500" />
								) : (
									<ShieldOff className="h-15 w-15 text-red-500" />
								)}
								<span>
									PII Anonymize {piiAnonymizeCheck ? "(Enabled)" : "(Disabled)"}
								</span>
							</DropdownMenuItem>
						)}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* New File Dialog */}
			<Dialog open={showFileDialog} onOpenChange={setShowFileDialog}>
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
						<p className="text-xs text-muted-foreground mt-2">
							Example: /src/main.py, /data/config.json
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => {
								setShowFileDialog(false);
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
		</>
	);
}

export default BaseToolMenu;
