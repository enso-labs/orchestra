import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Save, ArrowLeft, Trash2, Loader2 } from "lucide-react";
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
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SkillService from "@/lib/services/skillService";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Skill } from "@/lib/entities/skill";

const formSchema = z.object({
	description: z
		.string()
		.min(1, { message: "Description is required." })
		.max(1024, { message: "Description must be under 1024 characters." }),
	content: z.string().min(1, { message: "Skill content is required." }),
	tags: z.string(),
	allowed_tools: z.string(),
	license: z.string().optional(),
	disabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

function SkillEditPage() {
	const navigate = useNavigate();
	const { skillName } = useParams<{ skillName: string }>();
	const [skill, setSkill] = useState<Skill | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [activeTab, setActiveTab] = useState("editor");

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			description: "",
			content: "",
			tags: "",
			allowed_tools: "",
			license: "",
			disabled: false,
		},
	});

	useEffect(() => {
		const loadSkill = async () => {
			if (!skillName) return;
			try {
				setIsLoading(true);
				const data = await SkillService.get(skillName);
				setSkill(data);
				form.reset({
					description: data.description,
					content: data.content,
					tags: (data.tags || []).join(", "),
					allowed_tools: (data.allowed_tools || []).join(", "),
					license: data.license || "",
					disabled: data.disabled,
				});
			} catch (error) {
				console.error("Failed to load skill:", error);
			} finally {
				setIsLoading(false);
			}
		};
		loadSkill();
	}, [skillName]);

	const onSubmit = async (values: FormValues) => {
		if (!skillName) return;
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

			const updated = await SkillService.update(skillName, {
				description: values.description.trim(),
				content: values.content,
				tags: tags.length > 0 ? tags : [],
				allowed_tools: allowed_tools.length > 0 ? allowed_tools : [],
				license: values.license?.trim() || undefined,
			});
			setSkill(updated);
			alert("Skill updated successfully!");
		} catch (error) {
			console.error("Failed to update skill:", error);
			alert("Failed to update skill. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleToggle = async () => {
		if (!skillName) return;
		try {
			const updated = await SkillService.toggle(skillName);
			setSkill(updated);
			form.setValue("disabled", updated.disabled);
		} catch (error) {
			console.error("Failed to toggle skill:", error);
		}
	};

	const handleDelete = async () => {
		if (!skillName) return;
		try {
			await SkillService.delete(skillName);
			navigate("/skills");
		} catch (error) {
			console.error("Failed to delete skill:", error);
			alert("Failed to delete skill. Please try again.");
		}
	};

	if (isLoading) {
		return (
			<ChatLayout>
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					<span className="ml-3 text-muted-foreground">
						Loading skill...
					</span>
				</div>
			</ChatLayout>
		);
	}

	if (!skill) {
		return (
			<ChatLayout>
				<div className="flex-1 flex flex-col items-center justify-center gap-4">
					<p className="text-muted-foreground">Skill not found</p>
					<Button
						variant="outline"
						onClick={() => navigate("/skills")}
					>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Skills
					</Button>
				</div>
			</ChatLayout>
		);
	}

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
									{skill.name}
								</h1>
								<p className="text-sm text-muted-foreground">
									Edit skill configuration and content
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-2 mr-2">
								<span className="text-sm text-muted-foreground">
									{skill.disabled ? "Disabled" : "Enabled"}
								</span>
								<Switch
									checked={!skill.disabled}
									onCheckedChange={handleToggle}
								/>
							</div>
							<Button
								onClick={form.handleSubmit(onSubmit)}
								disabled={isSaving}
								className="flex items-center gap-2"
							>
								<Save className="h-4 w-4" />
								{isSaving ? "Saving..." : "Save"}
							</Button>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="destructive" size="icon">
										<Trash2 className="h-4 w-4" />
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Delete skill
										</AlertDialogTitle>
										<AlertDialogDescription>
											Are you sure you want to delete
											&quot;{skill.name}&quot;? This
											action cannot be undone.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>
											Cancel
										</AlertDialogCancel>
										<AlertDialogAction onClick={handleDelete}>
											Delete
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
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
										{/* Name (read-only) */}
										<div className="space-y-2">
											<label className="text-sm font-medium leading-none">
												Name
											</label>
											<Input
												value={skill.name}
												disabled
											/>
											<p className="text-[0.8rem] text-muted-foreground">
												Skill name cannot be changed
												after creation
											</p>
										</div>

										{/* Description */}
										<FormField
											control={form.control}
											name="description"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														Description
													</FormLabel>
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
														Comma-separated list of
														tags
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
													<FormLabel>
														Allowed Tools
													</FormLabel>
													<FormControl>
														<Input
															placeholder="e.g., search, code-interpreter"
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Comma-separated list of
														tools this skill can use
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
													<FormLabel>
														License
													</FormLabel>
													<FormControl>
														<Input
															placeholder="e.g., MIT, Apache-2.0"
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Optional license for
														this skill
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
															checked={
																!field.value
															}
															onCheckedChange={(
																checked,
															) =>
																field.onChange(
																	!checked,
																)
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

export default SkillEditPage;
