import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Save, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SkillService from "@/lib/services/skillService";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";

const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const formSchema = z.object({
	name: z
		.string()
		.min(2, { message: "Name must be at least 2 characters." })
		.regex(KEBAB_CASE_REGEX, {
			message:
				"Name must be kebab-case (lowercase letters, numbers, and hyphens).",
		}),
	description: z
		.string()
		.min(1, { message: "Description is required." })
		.max(1024, { message: "Description must be under 1024 characters." }),
	content: z
		.string()
		.min(1, { message: "Skill content is required." }),
	tags: z.string(),
	allowed_tools: z.string(),
	license: z.string().optional(),
	disabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

function SkillCreatePage() {
	const navigate = useNavigate();
	const [isSaving, setIsSaving] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [activeTab, setActiveTab] = useState("editor");

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			content: "",
			tags: "",
			allowed_tools: "",
			license: "",
			disabled: false,
		},
	});

	const handleGenerate = async () => {
		try {
			setIsGenerating(true);
			const name = form.getValues("name").trim();
			const description = form.getValues("description").trim();
			const tagsStr = form.getValues("tags");
			const tags = tagsStr
				? tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
				: [];

			const result = await SkillService.generate({
				name,
				description,
				tags: tags.length > 0 ? tags : undefined,
			});

			form.setValue("content", result.content, { shouldValidate: true });
			if (!tagsStr && result.tags.length > 0) {
				form.setValue("tags", result.tags.join(", "));
			}
			setActiveTab("editor");
			toast.success("Skill content generated successfully");
		} catch (error) {
			console.error("Failed to generate skill:", error);
			toast.error("Failed to generate skill content. Please try again.");
		} finally {
			setIsGenerating(false);
		}
	};

	const canGenerate =
		form.watch("name").trim().length > 0 &&
		form.watch("description").trim().length > 0;

	const onSubmit = async (values: FormValues) => {
		try {
			setIsSaving(true);
			const tags = values.tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);
			const allowed_tools = values.allowed_tools
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);

			await SkillService.create({
				name: values.name.trim(),
				description: values.description.trim(),
				content: values.content,
				tags: tags.length > 0 ? tags : undefined,
				allowed_tools: allowed_tools.length > 0 ? allowed_tools : undefined,
				license: values.license?.trim() || undefined,
			});

			navigate("/skills");
		} catch (error) {
			console.error("Failed to create skill:", error);
			alert("Failed to create skill. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<ChatNav sidebarTrigger={<SidebarTrigger />} />

				{/* Header */}
				<div className="flex-shrink-0 px-4 pt-4">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-4">
							<Button
								variant="ghost"
								size="icon"
								onClick={() => navigate("/skills")}
							>
								<ArrowLeft className="h-4 w-4" />
							</Button>
							<div>
								<h1 className="text-2xl font-bold text-foreground">
									Create Skill
								</h1>
								<p className="text-sm text-muted-foreground">
									Create a reusable skill for your agents
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{form.watch("content").trim() ? (
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="secondary"
											disabled={!canGenerate || isGenerating}
											className="flex items-center gap-2"
										>
											<Sparkles className="h-4 w-4" />
											{isGenerating ? "Generating..." : "Generate with AI"}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Overwrite editor content?</AlertDialogTitle>
											<AlertDialogDescription>
												The editor already has content. Generating will replace it with AI-generated content. This cannot be undone.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction onClick={handleGenerate}>
												Generate
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							) : (
								<Button
									variant="secondary"
									onClick={handleGenerate}
									disabled={!canGenerate || isGenerating}
									className="flex items-center gap-2"
								>
									<Sparkles className="h-4 w-4" />
									{isGenerating ? "Generating..." : "Generate with AI"}
								</Button>
							)}
							<Button
								onClick={form.handleSubmit(onSubmit)}
								disabled={isSaving}
								className="flex items-center gap-2"
							>
								<Save className="h-4 w-4" />
								{isSaving ? "Saving..." : "Save Skill"}
							</Button>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex-1 flex flex-col min-h-0 px-4"
				>
					<TabsList className="flex-shrink-0 w-fit">
						<TabsTrigger value="editor">Editor</TabsTrigger>
						<TabsTrigger value="settings">Settings</TabsTrigger>
					</TabsList>

					<TabsContent
						value="editor"
						className="flex-1 min-h-0 m-0 mt-2"
					>
						<div className="flex flex-col h-full border rounded-lg overflow-hidden">
							<MonacoEditor
								value={form.watch("content")}
								handleChange={(val) =>
									form.setValue("content", val, {
										shouldValidate: true,
									})
								}
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
						value="settings"
						className="flex-1 min-h-0 m-0 mt-2 pb-4"
					>
						<ScrollArea className="h-full">
							<Form {...form}>
								<form className="space-y-6 max-w-2xl">
									<div className="border border-border rounded-lg p-6 space-y-4">
										{/* Name */}
										<FormField
											control={form.control}
											name="name"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Name</FormLabel>
													<FormControl>
														<Input
															placeholder="e.g., code-review"
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Kebab-case identifier (lowercase
														letters, numbers, hyphens)
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* Description */}
										<FormField
											control={form.control}
											name="description"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Description</FormLabel>
													<FormControl>
														<Textarea
															placeholder="A brief description of what this skill does..."
															className="min-h-[80px]"
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Max 1024 characters
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* Tags */}
										<FormField
											control={form.control}
											name="tags"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Tags</FormLabel>
													<FormControl>
														<Input
															placeholder="e.g., coding, review, python"
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Comma-separated list of tags
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* Allowed Tools */}
										<FormField
											control={form.control}
											name="allowed_tools"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Allowed Tools</FormLabel>
													<FormControl>
														<Input
															placeholder="e.g., search, code-interpreter"
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Comma-separated list of tools this
														skill can use
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* License */}
										<FormField
											control={form.control}
											name="license"
											render={({ field }) => (
												<FormItem>
													<FormLabel>License</FormLabel>
													<FormControl>
														<Input
															placeholder="e.g., MIT, Apache-2.0"
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Optional license for this skill
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* Disabled Toggle */}
										<FormField
											control={form.control}
											name="disabled"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="space-y-0.5">
														<FormLabel className="text-base">
															{field.value
																? "Disabled"
																: "Enabled"}
														</FormLabel>
														<FormDescription>
															{field.value
																? "This skill is disabled and won't be available to agents"
																: "This skill is enabled and available to agents"}
														</FormDescription>
													</div>
													<FormControl>
														<Switch
															checked={!field.value}
															onCheckedChange={(checked) =>
																field.onChange(!checked)
															}
														/>
													</FormControl>
												</FormItem>
											)}
										/>
									</div>
								</form>
							</Form>
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</div>
		</ChatLayout>
	);
}

export default SkillCreatePage;
