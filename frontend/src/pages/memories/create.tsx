import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import MarkdownCard from "@/components/cards/MarkdownCard";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import MemoryService from "@/lib/services/memoryService";

export default function MemoryCreatePage() {
	const navigate = useNavigate();
	const [path, setPath] = useState("");
	const [content, setContent] = useState("");
	const [saving, setSaving] = useState(false);
	const [activeTab, setActiveTab] = useState("editor");

	const isValid = path.trim().length > 0 && content.trim().length > 0;

	const handleSave = async () => {
		if (!isValid) return;
		setSaving(true);
		try {
			await MemoryService.create({
				path: path.trim(),
				content: content.trim(),
			});
			toast.success("Memory created");
			navigate("/settings");
		} catch {
			toast.error("Failed to create memory");
		} finally {
			setSaving(false);
		}
	};

	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				{/* Nav */}
				<div className="flex items-center justify-between px-4 pt-4 pb-2">
					<div className="flex items-center gap-2">
						<SidebarTrigger />
					</div>
					<ChatNav sidebarTrigger={null} />
				</div>

				{/* Header */}
				<div className="flex items-center justify-between px-4 py-2 border-b border-border">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => navigate("/settings")}
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<h1 className="text-lg font-semibold">Create Memory</h1>
					</div>
					<div className="flex items-center gap-3">
						<Button
							size="sm"
							onClick={handleSave}
							disabled={!isValid || saving}
						>
							<Save className="h-4 w-4 mr-1" />
							{saving ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>

				{/* File name */}
				<div className="px-4 py-3">
					<div className="grid gap-1.5 max-w-sm">
						<Label htmlFor="memory-path">File Name</Label>
						<Input
							id="memory-path"
							value={path}
							onChange={(e) => setPath(e.target.value)}
							placeholder="e.g. AGENTS.md, USER.md"
						/>
					</div>
				</div>

				{/* Tabs */}
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex-1 flex flex-col min-h-0"
				>
					<div className="px-4">
						<TabsList>
							<TabsTrigger value="editor">Editor</TabsTrigger>
							<TabsTrigger value="preview">Preview</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent
						value="editor"
						className="flex-1 min-h-0 m-0 px-4 pb-4"
					>
						<div className="h-full rounded-md border overflow-hidden">
							<MonacoEditor
								value={content}
								handleChange={(val) => setContent(val)}
								language="markdown"
								height="100%"
								options={{
									wordWrap: "on",
									minimap: false,
									fontSize: 14,
									lineNumbers: "on",
								}}
							/>
						</div>
					</TabsContent>

					<TabsContent
						value="preview"
						className="flex-1 min-h-0 m-0 px-4 pb-4"
					>
						<ScrollArea className="h-full rounded-md border p-4">
							{content.trim() ? (
								<MarkdownCard content={content} />
							) : (
								<p className="text-muted-foreground text-sm">
									Nothing to preview yet. Switch to the Editor tab to
									start writing.
								</p>
							)}
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</div>
		</ChatLayout>
	);
}
