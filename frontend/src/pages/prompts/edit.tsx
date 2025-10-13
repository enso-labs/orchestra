import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	Save,
	ArrowLeft,
	Maximize2,
	Download,
	Globe,
	Lock,
	Trash2,
	GitBranch,
	History,
} from "lucide-react";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import promptService from "@/lib/services/promptService";
import { usePromptContext } from "@/context/PromptContext";
import { Prompt } from "@/lib/entities/prompt";
import MonacoEditor from "@/components/inputs/MonacoEditor";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	content: z.string().min(10, {
		message: "Content must be at least 10 characters.",
	}),
	public: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export default function PromptEditPage() {
	const navigate = useNavigate();
	const { promptId } = useParams<{ promptId: string }>();
	const { refreshPrompts } = usePromptContext();
	const [prompt, setPrompt] = useState<Prompt | null>(null);
	const [revisions, setRevisions] = useState<Prompt[]>([]);
	const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const [fullscreenContent, setFullscreenContent] = useState("");
	const [contentUrl, setContentUrl] = useState("");
	const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [showHistory, setShowHistory] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			content: "",
			public: false,
		},
	});

	// Load prompt and revisions
	useEffect(() => {
		const loadPrompt = async () => {
			if (!promptId) return;

			try {
				setIsLoading(true);
				const revisionsResponse = await promptService.listRevisions(promptId);
				const revisionsList = revisionsResponse.data.revisions || [];
				setRevisions(revisionsList);

				if (revisionsList.length > 0) {
					// Get the latest revision (last in array)
					const latestRevision = revisionsList[revisionsList.length - 1];
					setPrompt(latestRevision);
					setSelectedVersion(latestRevision.v || 1);

					form.reset({
						name: latestRevision.name,
						content: latestRevision.content,
						public: latestRevision.public,
					});
				}
			} catch (error) {
				console.error("Failed to load prompt:", error);
				alert("Failed to load prompt. Please try again.");
			} finally {
				setIsLoading(false);
			}
		};

		loadPrompt();
	}, [promptId]);

	// Load specific version when selected
	const loadVersion = async (version: number) => {
		if (!promptId) return;

		try {
			const versionPrompt = revisions.find((r) => r.v === version);
			if (versionPrompt) {
				setPrompt(versionPrompt);
				setSelectedVersion(version);
				form.reset({
					name: versionPrompt.name,
					content: versionPrompt.content,
					public: versionPrompt.public,
				});
			}
		} catch (error) {
			console.error("Failed to load version:", error);
			alert("Failed to load version. Please try again.");
		}
	};

	const onUpdate = async (values: FormValues) => {
		if (!promptId || !prompt) return;

		try {
			setIsSaving(true);
			await promptService.createRevision(promptId, {
				name: values.name.trim(),
				content: values.content.trim(),
				public: values.public,
				v: prompt.v,
			});

			alert("Prompt updated successfully!");
			await refreshPrompts();
			// Reload revisions
			const revisionsResponse = await promptService.listRevisions(promptId);
			setRevisions(revisionsResponse.data.revisions || []);
		} catch (error) {
			console.error("Failed to update prompt:", error);
			alert("Failed to update prompt. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	const onNewVersion = async (values: FormValues) => {
		if (!promptId || !prompt) return;

		const confirmed = confirm(
			"Create a new version? This will increment the version number.",
		);
		if (!confirmed) return;

		try {
			setIsSaving(true);
			await promptService.createRevision(promptId, {
				name: values.name.trim(),
				content: values.content.trim(),
				public: values.public,
			});

			alert("New version created successfully!");
			await refreshPrompts();
			// Reload revisions
			const revisionsResponse = await promptService.listRevisions(promptId);
			const revisionsList = revisionsResponse.data.revisions || [];
			setRevisions(revisionsList);
			const latestRevision = revisionsList[revisionsList.length - 1];
			setPrompt(latestRevision);
			setSelectedVersion(latestRevision.v || 1);
		} catch (error) {
			console.error("Failed to create new version:", error);
			alert("Failed to create new version. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	const togglePublicVisibility = async () => {
		if (!promptId) return;

		try {
			const response = await promptService.togglePublic(promptId);
			const newPublicState = response.data.public;

			alert(
				`Prompt is now ${newPublicState ? "public" : "private"}!`,
			);
			await refreshPrompts();
			// Reload revisions to update state
			const revisionsResponse = await promptService.listRevisions(promptId);
			const revisionsList = revisionsResponse.data.revisions || [];
			setRevisions(revisionsList);
			const currentRevision = revisionsList.find((r: Prompt) => r.v === selectedVersion);
			if (currentRevision) {
				setPrompt(currentRevision);
				form.setValue("public", currentRevision.public);
			}
		} catch (error) {
			console.error("Failed to toggle visibility:", error);
			alert("Failed to toggle visibility. Please try again.");
		}
	};

	const deletePrompt = async () => {
		if (!promptId || !prompt || !prompt.v) return;

		const confirmed = confirm(
			"Are you sure you want to delete this version? This action cannot be undone.",
		);
		if (!confirmed) return;

		try {
			await promptService.deleteRevision(promptId, prompt.v);
			alert("Version deleted successfully!");
			await refreshPrompts();
			navigate("/prompts");
		} catch (error) {
			console.error("Failed to delete version:", error);
			alert("Failed to delete version. Please try again.");
		}
	};

	const openFullscreen = () => {
		setFullscreenContent(form.getValues("content") || "");
		setIsFullscreenOpen(true);
	};

	const saveFullscreenContent = () => {
		form.setValue("content", fullscreenContent);
		setIsFullscreenOpen(false);
	};

	const fetchContentFromUrl = async () => {
		if (!contentUrl.trim()) {
			alert("Please enter a valid URL");
			return;
		}

		setIsLoadingFromUrl(true);
		try {
			const response = await fetch(contentUrl);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const content = await response.text();
			setFullscreenContent(content);
			alert("Content loaded from URL successfully!");
		} catch (error) {
			console.error("Error fetching content from URL:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			alert(`Failed to fetch from URL: ${errorMessage}`);
		} finally {
			setIsLoadingFromUrl(false);
		}
	};

	const formatDate = (dateString?: string) => {
		if (!dateString) return "No date";
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<p className="text-muted-foreground">Loading prompt...</p>
			</div>
		);
	}

	if (!prompt) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<p className="text-muted-foreground">Prompt not found</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-6xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => navigate("/prompts")}
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-2xl font-bold text-foreground">
									{prompt.name}
								</h1>
								<Badge variant="outline">v{prompt.v}</Badge>
								<Badge variant={prompt.public ? "default" : "secondary"}>
									{prompt.public ? (
										<>
											<Globe className="h-3 w-3 mr-1" />
											Public
										</>
									) : (
										<>
											<Lock className="h-3 w-3 mr-1" />
											Private
										</>
									)}
								</Badge>
							</div>
							<p className="text-sm text-muted-foreground">
								Last updated: {formatDate(prompt.updated_at)}
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowHistory(!showHistory)}
						>
							<History className="h-4 w-4 mr-2" />
							{showHistory ? "Hide" : "Show"} History
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={form.handleSubmit(onNewVersion)}
							disabled={isSaving}
						>
							<GitBranch className="h-4 w-4 mr-2" />
							New Version
						</Button>
						<Button
							type="submit"
							size="sm"
							onClick={form.handleSubmit(onUpdate)}
							disabled={isSaving}
							className="flex items-center gap-2"
						>
							<Save className="h-4 w-4" />
							{isSaving ? "Saving..." : "Update"}
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={deletePrompt}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Main Form */}
					<div className="lg:col-span-2">
						<Form {...form}>
							<form className="space-y-6">
								<div className="border border-border rounded-lg p-6 space-y-4">
									{/* Version Selector */}
									<div className="flex items-center gap-4">
										<FormLabel>Version</FormLabel>
										<Select
											value={selectedVersion?.toString()}
											onValueChange={(v) => loadVersion(parseInt(v))}
										>
											<SelectTrigger className="w-32">
												<SelectValue placeholder="Select version" />
											</SelectTrigger>
											<SelectContent>
												{revisions.map((rev) => (
													<SelectItem key={rev.v} value={rev.v?.toString() || "1"}>
														v{rev.v}
														{rev.v === prompt.v && " (current)"}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{/* Name */}
									<FormField
										control={form.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Name</FormLabel>
												<FormControl>
													<Input placeholder="E.g., Customer Support Expert" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Content */}
									<FormField
										control={form.control}
										name="content"
										render={({ field }) => (
											<FormItem>
												<div className="flex items-center justify-between">
													<FormLabel>Content</FormLabel>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={openFullscreen}
														className="h-6 px-2"
													>
														<Maximize2 className="h-3 w-3 mr-1" />
														Fullscreen
													</Button>
												</div>
												<FormControl>
													<Textarea
														{...field}
														placeholder="Enter your system prompt content..."
														className="min-h-[400px] font-mono"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Public Toggle */}
									<FormField
										control={form.control}
										name="public"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base flex items-center gap-2">
														{field.value ? (
															<Globe className="h-4 w-4" />
														) : (
															<Lock className="h-4 w-4" />
														)}
														{field.value ? "Public" : "Private"}
													</FormLabel>
													<FormDescription>
														{field.value
															? "Anyone can view and use this prompt"
															: "Only you can view and use this prompt"}
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={field.value}
														onCheckedChange={(checked) => {
															field.onChange(checked);
															togglePublicVisibility();
														}}
													/>
												</FormControl>
											</FormItem>
										)}
									/>
								</div>
							</form>
						</Form>
					</div>

					{/* Version History Sidebar */}
					{showHistory && (
						<div className="lg:col-span-1">
							<div className="border border-border rounded-lg p-6">
								<h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
									<History className="h-5 w-5" />
									Version History
								</h3>
								<ScrollArea className="h-96">
									<div className="space-y-2">
										{revisions
											.slice()
											.reverse()
											.map((rev) => (
												<div
													key={rev.v}
													className={`p-3 border rounded-md cursor-pointer hover:bg-muted transition-colors ${
														rev.v === selectedVersion
															? "bg-muted border-primary"
															: ""
													}`}
													onClick={() => loadVersion(rev.v || 1)}
												>
													<div className="flex items-center justify-between mb-1">
														<Badge variant="outline">v{rev.v}</Badge>
														{rev.v === prompt.v && (
															<Badge variant="default" className="text-xs">
																Current
															</Badge>
														)}
													</div>
													<p className="text-xs text-muted-foreground">
														{formatDate(rev.updated_at)}
													</p>
													<p className="text-sm mt-1 line-clamp-2">
														{rev.content.substring(0, 80)}...
													</p>
												</div>
											))}
									</div>
								</ScrollArea>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Fullscreen Editor Dialog */}
			<Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
				<DialogContent className="max-w-[99vw] max-h-[99vh] h-[99vh] w-[99vw] flex flex-col">
					<DialogHeader className="flex-shrink-0">
						<DialogTitle className="flex items-center justify-between">
							<span>Prompt Content Editor</span>
							<div className="flex gap-2">
								<Input
									value={contentUrl}
									onChange={(e) => setContentUrl(e.target.value)}
									placeholder="Enter URL to fetch content..."
									className="w-96"
								/>
								<Button
									type="button"
									variant="outline"
									onClick={fetchContentFromUrl}
									disabled={isLoadingFromUrl || !contentUrl.trim()}
									className="flex items-center gap-2"
								>
									{isLoadingFromUrl ? (
										<>Loading...</>
									) : (
										<>
											<Download className="h-4 w-4" />
											Fetch
										</>
									)}
								</Button>
							</div>
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 flex-1 min-h-0">
						<div className="flex-1 min-h-0 h-full">
							<MonacoEditor
								value={fullscreenContent}
								handleChange={setFullscreenContent}
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
						<div className="flex gap-2 justify-end flex-shrink-0">
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsFullscreenOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={saveFullscreenContent}
								className="flex items-center gap-2"
								disabled={!fullscreenContent.trim()}
							>
								<Save className="h-4 w-4" />
								Save Changes
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
