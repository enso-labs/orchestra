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
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import promptService from "@/lib/services/promptService";
import { usePromptContext } from "@/context/PromptContext";
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

export default function PromptCreatePage() {
	const navigate = useNavigate();
	const { refreshPrompts } = usePromptContext();
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const [fullscreenContent, setFullscreenContent] = useState("");
	const [contentUrl, setContentUrl] = useState("");
	const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			content: "",
			public: false,
		},
	});

	const onSubmit = async (values: FormValues) => {
		try {
			setIsSaving(true);
			const response = await promptService.create({
				name: values.name.trim(),
				content: values.content.trim(),
				public: values.public,
			});

			alert(`Prompt "${values.name}" created successfully!`);
			await refreshPrompts();
			navigate(`/prompts/${response.data.prompt_id}/edit`);
		} catch (error) {
			console.error("Failed to create prompt:", error);
			alert("Failed to create prompt. Please try again.");
		} finally {
			setIsSaving(false);
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

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-4xl mx-auto">
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
							<h1 className="text-2xl font-bold text-foreground">
								Create Prompt
							</h1>
							<p className="text-sm text-muted-foreground">
								Create a reusable system prompt for your agents
							</p>
						</div>
					</div>
					<Button
						type="submit"
						onClick={form.handleSubmit(onSubmit)}
						disabled={isSaving}
						className="flex items-center gap-2"
					>
						<Save className="h-4 w-4" />
						{isSaving ? "Saving..." : "Save Prompt"}
					</Button>
				</div>

				{/* Form */}
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<div className="border border-border rounded-lg p-6 space-y-4">
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
										<FormDescription>
											A descriptive name for this prompt
										</FormDescription>
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
												Fullscreen Editor
											</Button>
										</div>
										<FormControl>
											<Textarea
												{...field}
												placeholder="Enter your system prompt content..."
												className="min-h-[200px] font-mono"
											/>
										</FormControl>
										<FormDescription>
											The system message content for your agents
										</FormDescription>
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
												onCheckedChange={field.onChange}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</form>
				</Form>
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
