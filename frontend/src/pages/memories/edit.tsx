import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import MarkdownCard from "@/components/cards/MarkdownCard";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Memory } from "@/lib/entities/memory";
import MemoryService from "@/lib/services/memoryService";

export default function MemoryEditPage() {
	const navigate = useNavigate();
	const { memoryId } = useParams<{ memoryId: string }>();
	const [memory, setMemory] = useState<Memory | null>(null);
	const [content, setContent] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("preview");

	useEffect(() => {
		const load = async () => {
			if (!memoryId) return;
			try {
				const mem = await MemoryService.get(memoryId);
				setMemory(mem);
				setContent(mem.content);
				setEnabled(mem.enabled);
			} catch {
				toast.error("Failed to load memory");
				navigate("/settings");
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [memoryId, navigate]);

	const handleSave = async () => {
		if (!memoryId || !memory) return;
		setSaving(true);
		try {
			await MemoryService.update(memoryId, { content });
			toast.success("Memory updated");
			navigate("/settings");
		} catch {
			toast.error("Failed to update memory");
		} finally {
			setSaving(false);
		}
	};

	const handleToggle = async () => {
		if (!memoryId) return;
		const prev = enabled;
		setEnabled(!prev);
		try {
			await MemoryService.toggle(memoryId);
		} catch {
			setEnabled(prev);
			toast.error("Failed to toggle memory");
		}
	};

	const handleDelete = async () => {
		if (!memoryId) return;
		try {
			await MemoryService.delete(memoryId);
			toast.success("Memory deleted");
			navigate("/settings");
		} catch {
			toast.error("Failed to delete memory");
		}
	};

	if (loading) {
		return (
			<ChatLayout>
				<div className="flex-1 flex items-center justify-center">
					<p className="text-muted-foreground">Loading memory...</p>
				</div>
			</ChatLayout>
		);
	}

	if (!memory) {
		return (
			<ChatLayout>
				<div className="flex-1 flex items-center justify-center">
					<p className="text-muted-foreground">Memory not found</p>
				</div>
			</ChatLayout>
		);
	}

	const hasChanges = content !== memory.content;

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
						<h1 className="text-lg font-semibold font-mono">{memory.id}</h1>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<Label
								htmlFor="memory-enabled"
								className="text-sm text-muted-foreground"
							>
								{enabled ? "Enabled" : "Disabled"}
							</Label>
							<Switch
								id="memory-enabled"
								checked={enabled}
								onCheckedChange={handleToggle}
							/>
						</div>
						<Button
							size="sm"
							onClick={handleSave}
							disabled={!hasChanges || saving}
						>
							<Save className="h-4 w-4 mr-1" />
							{saving ? "Saving..." : "Save"}
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => setDeleteOpen(true)}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Tabs */}
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex-1 flex flex-col min-h-0"
				>
					<div className="px-4 pt-2">
						<TabsList>
							<TabsTrigger value="preview">Preview</TabsTrigger>
							<TabsTrigger value="editor">Editor</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="preview" className="flex-1 min-h-0 m-0 px-4 pb-4">
						<ScrollArea className="h-full rounded-md border p-4">
							<MarkdownCard content={content} />
						</ScrollArea>
					</TabsContent>

					<TabsContent value="editor" className="flex-1 min-h-0 m-0 px-4 pb-4">
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
				</Tabs>
			</div>

			{/* Delete confirmation */}
			<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Memory</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this memory? This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ChatLayout>
	);
}
