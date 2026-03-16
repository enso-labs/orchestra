import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	Computer,
	Wrench,
	Save,
	Maximize2,
	Download,
	ToggleLeft,
	ToggleRight,
	Pencil,
	Trash2,
	Users,
	Check,
	X,
	Library,
	FileText,
	Ban,
	Globe,
	Lock,
	GitFork,
} from "lucide-react";
import { ToolSelectionModal } from "@/components/modals/ToolSelectionModal";
import { PromptSelectionModal } from "@/components/modals/PromptSelectionModal";

import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import agentService, { Agent } from "@/lib/services/agentService";
import AgentService from "@/lib/services/agentService";
import SelectModel from "@/components/lists/SelectModel";
import { Link, useNavigate, useParams } from "react-router-dom";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import { Prompt } from "@/lib/entities/prompt";
import { cn } from "@/lib/utils";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	description: z.string(),
	systemMessage: z.string().optional(),
	instructions: z.string().optional(),
	model: z.string().min(2, {
		message: "Model must be at least 2 characters.",
	}),
	public: z.boolean(),
});

export function AgentCreateForm() {
	const navigate = useNavigate();
	const { agentId } = useParams();
	const {
		agent,
		agents,
		setAgent,
		toggleSubagent,
		isAgentSelected,
		updateQueryStateModel,
	} = useAgentContext();
	const { toBackendFormat, setModel } = useChatContext();
	const [isEditing, setIsEditing] = useState(!agentId);
	const [originalAgent, setOriginalAgent] = useState<Agent | null>(null);
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const [fullscreenSystemMessage, setFullscreenSystemMessage] = useState("");
	const [systemMessageUrl, setSystemMessageUrl] = useState("");
	const [isUsingUrl, setIsUsingUrl] = useState(false);
	const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
	const [isToolModalOpen, setIsToolModalOpen] = useState(false);
	const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
	const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
	const [forkedFromName, setForkedFromName] = useState<string | null>(null);
	const [promptMode, setPromptMode] = useState<
		"instructions" | "system_prompt"
	>("instructions");
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			systemMessage: "",
			instructions: "",
			public: false,
		},
	});

	useEffect(() => {
		setIsEditing(!agentId);
	}, [agentId]);

	const handleEdit = () => {
		setOriginalAgent(JSON.parse(JSON.stringify(agent)));
		setIsEditing(true);
	};

	const handleCancel = () => {
		if (originalAgent) {
			setAgent(originalAgent);
		}
		setIsEditing(false);
	};

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		// Collect file_system from fileSystem hook
		const fileSystemData = toBackendFormat();

		const configData: Agent = {
			name: values.name.trim(),
			description: values.description.trim(),
			model: values.model.trim(),
			mcp: agent.mcp,
			a2a: agent.a2a,
			tools: agent.tools,
			subagents: agent.subagents,
			// Include file_system only if there are files
			...(Object.keys(fileSystemData).length > 0 && {
				files: fileSystemData,
			}),
		};

		if (promptMode === "instructions") {
			const instructionContent = selectedPrompt
				? `{{prompt:${selectedPrompt.id}:v${selectedPrompt.v}}}`
				: values.instructions?.trim() || "";

			configData.instructions = instructionContent;
			// We do not force a system prompt here.
			// If undefined, the backend will apply its default ("You are a helpful assistant.")
			// or keep the existing one if we were doing a partial update (but here we replace).
			// If we wanted to strictly enforce the default, we would set it here.
			// configData.system_prompt = "You are a helpful assistant.";
		} else {
			const systemContent = selectedPrompt
				? `{{prompt:${selectedPrompt.id}:v${selectedPrompt.v}}}`
				: values.systemMessage?.trim() || "";

			configData.system_prompt = systemContent;
			configData.instructions = "";
		}

		if (!agent.id) {
			console.log("Saving agent configuration:", configData);
			const response = await agentService.create(configData);
			alert(`${values.name} created successfully!`);
			navigate(`/a/${response.data.assistant_id}`);
		} else {
			const confirmed = confirm(
				"Are you sure you want to update this agent? This action cannot be undone.",
			);
			if (!confirmed) return;

			console.log("Updating agent configuration:", configData);
			await agentService.update(agent.id, configData);
			alert(`${values.name} updated successfully!`);
			setIsEditing(false);
			// navigate(`/assistants`);
		}
	};

	const deleteAgent = async () => {
		if (!agent.id) return;

		const confirmed = confirm(
			"Are you sure you want to delete this agent? This action cannot be undone.",
		);
		if (!confirmed) return;

		try {
			await agentService.delete(agent.id);
			navigate("/assistants");
			// Navigate back to agents list or handle post-delete action
		} catch (error) {
			console.error("Failed to delete agent:", error);
			alert("Failed to delete agent. Please try again.");
		}
	};

	const openFullscreen = () => {
		if (promptMode === "instructions") {
			setFullscreenSystemMessage(form.getValues("instructions") || "");
		} else {
			setFullscreenSystemMessage(form.getValues("systemMessage") || "");
		}
		setIsFullscreenOpen(true);
	};

	const saveFullscreenSystemMessage = () => {
		if (promptMode === "instructions") {
			setAgent({ ...agent, instructions: fullscreenSystemMessage });
			form.setValue("instructions", fullscreenSystemMessage);
		} else {
			setAgent({ ...agent, system_prompt: fullscreenSystemMessage });
			form.setValue("systemMessage", fullscreenSystemMessage);
		}
		setIsFullscreenOpen(false);
	};

	const handleFullscreenSystemMessageChange = (value: string) => {
		setFullscreenSystemMessage(value);
	};

	const fetchSystemMessageFromUrl = async () => {
		if (!systemMessageUrl.trim()) {
			alert("Please enter a valid URL");
			return;
		}

		setIsLoadingFromUrl(true);
		try {
			const response = await fetch(systemMessageUrl);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const content = await response.text();
			setFullscreenSystemMessage(content);
			alert("System message loaded from URL successfully!");
		} catch (error) {
			console.error("Error fetching system message from URL:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			alert(`Failed to fetch from URL: ${errorMessage}`);
		} finally {
			setIsLoadingFromUrl(false);
		}
	};

	const toggleUrlMode = () => {
		setIsUsingUrl(!isUsingUrl);
		if (!isUsingUrl) {
			// Switching to URL mode, clear the manual input
			setFullscreenSystemMessage("");
		}
	};

	useEffect(() => {
		form.setValue("name", agent.name);
		form.setValue("description", agent.description);
		form.setValue("model", agent.model);
		form.setValue("public", agent.public || false);

		// Sync ChatContext model so SelectModel displays the agent's saved model
		if (agent.model) {
			setModel(agent.model);
		}

		// Determine mode and set values
		if (
			(agent.instructions && agent.instructions.length > 0) ||
			(agent.instructions &&
				agent.system_prompt &&
				agent.system_prompt.length > 0)
		) {
			setPromptMode("instructions");
			form.setValue("instructions", agent.instructions);
			form.setValue("systemMessage", agent.system_prompt || "");
		} else if (
			agent.system_prompt &&
			agent.system_prompt !== "You are a helpful assistant."
		) {
			setPromptMode("system_prompt");
			form.setValue("systemMessage", agent.system_prompt);
			form.setValue("instructions", "");
		} else {
			// Default or check legacy prompt
			if (agent.prompt && agent.prompt !== "You are a helpful assistant.") {
				setPromptMode("system_prompt");
				form.setValue("systemMessage", agent.prompt);
			} else {
				// Default state - no prefill
				setPromptMode("instructions");
				form.setValue("instructions", "");
				form.setValue("systemMessage", "");
			}
		}
	}, [agent]);

	// Fetch original agent name for "Remixed from" attribution
	const forkedFromId = (agent.metadata as Record<string, unknown>)
		?.forked_from as string | undefined;
	useEffect(() => {
		if (!forkedFromId) {
			setForkedFromName(null);
			return;
		}
		AgentService.getPublic(forkedFromId)
			.then((res) => setForkedFromName(res.data?.name ?? null))
			.catch(() => setForkedFromName(null));
	}, [forkedFromId]);

	const filteredSubagents = agents.filter((a: Agent) => a.id !== agentId);

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				<div className="border border-border rounded-lg p-6">
					<div className="flex items-start justify-between mb-6">
						<div className="flex items-center gap-3">
							<Computer className="h-5 w-5 text-foreground" />
							<div>
								<h2 className="text-lg font-semibold text-foreground">
									Basic Configuration
								</h2>
								<p className="text-sm text-muted-foreground">
									Configure the basic settings for your AI agent
								</p>
								{forkedFromId && (
									<p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
										<GitFork className="h-3 w-3" />
										Remixed from{" "}
										<Link
											to={`/a/${forkedFromId}`}
											className="text-primary hover:underline"
										>
											{forkedFromName ?? forkedFromId}
										</Link>
									</p>
								)}
							</div>
						</div>
						{agent.id ? (
							<div className="flex items-center gap-2">
								{isEditing ? (
									<>
										<Button
											type="button"
											variant="outline"
											size="icon"
											onClick={handleCancel}
											aria-label="Cancel"
											title="Cancel"
										>
											<Ban className="h-4 w-4" />
										</Button>
										<Button
											type="button"
											variant="default"
											size="icon"
											onClick={form.handleSubmit(onSubmit)}
											aria-label="Save"
											title="Save"
										>
											<Save className="h-4 w-4" />
										</Button>
									</>
								) : (
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={handleEdit}
										aria-label="Edit"
										title="Edit"
									>
										<Pencil className="h-4 w-4" />
									</Button>
								)}
								<Button
									type="button"
									variant="destructive"
									size="icon"
									onClick={deleteAgent}
									aria-label="Delete"
									title="Delete"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						) : (
							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={form.handleSubmit(onSubmit)}
								aria-label="Save"
								title="Save"
							>
								<Save className="h-4 w-4" />
							</Button>
						)}
					</div>
					<div className="flex flex-col gap-2">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input
											disabled={!isEditing}
											placeholder="Agent name"
											className={
												!isEditing
													? "opacity-60 bg-muted/50 cursor-not-allowed"
													: ""
											}
											{...field}
											onChangeCapture={(e) =>
												setAgent({ ...agent, name: e.currentTarget.value })
											}
										/>
									</FormControl>
									{/* <FormDescription>This is your agent name.</FormDescription> */}
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel
										className={!isEditing ? "text-muted-foreground/70" : ""}
									>
										Description
									</FormLabel>
									<FormControl>
										<Textarea
											disabled={!isEditing}
											placeholder="Agent description"
											className={
												!isEditing
													? "opacity-60 bg-muted/50 cursor-not-allowed"
													: ""
											}
											{...field}
											onChangeCapture={(e) =>
												setAgent({
													...agent,
													description: e.currentTarget.value,
												})
											}
										/>
									</FormControl>
									<p className="text-xs text-muted-foreground mt-2">
										Provides a brief description of the assistant. When to use
										it, and how it works.
									</p>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Tabs
							value={promptMode}
							onValueChange={(v) => isEditing && setPromptMode(v as any)}
							className={cn(
								"w-full",
								!isEditing && "opacity-60 pointer-events-none",
							)}
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="instructions">Instructions</TabsTrigger>
								<TabsTrigger value="system_prompt">System Prompt</TabsTrigger>
							</TabsList>

							<TabsContent value="instructions" className="mt-4">
								<FormField
									control={form.control}
									name="instructions"
									render={({ field }) => (
										<FormItem>
											<div className="flex items-center justify-between">
												<FormLabel
													className={
														!isEditing ? "text-muted-foreground/70" : ""
													}
												>
													Instructions
												</FormLabel>
												<div className="flex gap-2">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														disabled={!isEditing}
														onClick={() => setIsPromptModalOpen(true)}
														className="h-6 px-2 text-xs"
													>
														<Library className="h-3 w-3 mr-1" />
														Browse
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={openFullscreen}
														className="h-6 px-2"
													>
														<Maximize2 className="h-3 w-3" />
													</Button>
												</div>
											</div>

											{/* Show selected prompt */}
											{selectedPrompt && promptMode === "instructions" && (
												<div className="p-3 border rounded-md bg-muted/50 mb-2">
													<div className="flex justify-between items-start">
														<div className="flex-1">
															<div className="flex items-center gap-2 mb-1">
																<FileText className="h-4 w-4 text-primary" />
																<p className="font-medium text-sm">
																	{selectedPrompt.name}
																</p>
																<Badge variant="outline" className="text-xs">
																	v{selectedPrompt.v}
																</Badge>
															</div>
															<p className="text-xs text-muted-foreground line-clamp-2">
																{selectedPrompt.content}
															</p>
														</div>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => {
																setSelectedPrompt(null);
																form.setValue("instructions", "");
															}}
															className="h-6 w-6 p-0 ml-2"
														>
															<X className="h-3 w-3" />
														</Button>
													</div>
												</div>
											)}

											<FormControl>
												<Textarea
													{...field}
													disabled={
														!isEditing ||
														(!!selectedPrompt && promptMode === "instructions")
													}
													placeholder={
														selectedPrompt
															? "Using saved prompt..."
															: "Enter instructions to guide the agent (e.g. 'You are a weather expert')..."
													}
													className={cn(
														"min-h-[150px]",
														!isEditing ||
															(!!selectedPrompt &&
																promptMode === "instructions")
															? "opacity-60 bg-muted/50 cursor-not-allowed"
															: "",
													)}
													onChangeCapture={(e) =>
														setAgent({
															...agent,
															instructions: e.currentTarget.value,
														})
													}
												/>
											</FormControl>
											<p className="text-xs text-muted-foreground mt-2">
												Instructions are appended to the default Ensō system
												prompt. This is the recommended way to customize agent
												behavior.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
							</TabsContent>

							<TabsContent value="system_prompt" className="mt-4">
								<FormField
									control={form.control}
									name="systemMessage"
									render={({ field }) => (
										<FormItem>
											<div className="flex items-center justify-between">
												<FormLabel
													className={
														!isEditing ? "text-muted-foreground/70" : ""
													}
												>
													System Prompt
												</FormLabel>
												<div className="flex gap-2">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														disabled={!isEditing}
														onClick={() => setIsPromptModalOpen(true)}
														className="h-6 px-2 text-xs"
													>
														<Library className="h-3 w-3 mr-1" />
														Browse
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={openFullscreen}
														className="h-6 px-2"
													>
														<Maximize2 className="h-3 w-3" />
													</Button>
												</div>
											</div>

											{/* Show selected prompt */}
											{selectedPrompt && promptMode === "system_prompt" && (
												<div className="p-3 border rounded-md bg-muted/50 mb-2">
													<div className="flex justify-between items-start">
														<div className="flex-1">
															<div className="flex items-center gap-2 mb-1">
																<FileText className="h-4 w-4 text-primary" />
																<p className="font-medium text-sm">
																	{selectedPrompt.name}
																</p>
																<Badge variant="outline" className="text-xs">
																	v{selectedPrompt.v}
																</Badge>
															</div>
															<p className="text-xs text-muted-foreground line-clamp-2">
																{selectedPrompt.content}
															</p>
														</div>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => {
																setSelectedPrompt(null);
																form.setValue("systemMessage", "");
															}}
															className="h-6 w-6 p-0 ml-2"
														>
															<X className="h-3 w-3" />
														</Button>
													</div>
												</div>
											)}

											<FormControl>
												<Textarea
													{...field}
													disabled={
														!isEditing ||
														(!!selectedPrompt && promptMode === "system_prompt")
													}
													placeholder={
														selectedPrompt
															? "Using saved prompt..."
															: "Enter complete system prompt..."
													}
													className={cn(
														"min-h-[150px]",
														!isEditing ||
															(!!selectedPrompt &&
																promptMode === "system_prompt")
															? "opacity-60 bg-muted/50 cursor-not-allowed"
															: "",
													)}
													onChangeCapture={(e) =>
														setAgent({
															...agent,
															system_prompt: e.currentTarget.value,
														})
													}
												/>
											</FormControl>
											<p className="text-xs text-muted-foreground mt-2">
												Completely replaces the default system prompt. Use this
												for advanced customization where full control is needed.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
							</TabsContent>
						</Tabs>
						<FormField
							control={form.control}
							name="model"
							render={() => (
								<FormItem>
									<FormLabel
										className={!isEditing ? "text-muted-foreground/70" : ""}
									>
										Model
									</FormLabel>
									<FormControl>
										<SelectModel
											disabled={!isEditing}
											onChange={(value) => {
												setModel(value);
												form.setValue("model", value);
												updateQueryStateModel(value);
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					{/* Public Toggle - Only show for existing agents */}
					{agent.id && (
						<FormField
							control={form.control}
							name="public"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-4">
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
												? "Anyone can view and use this agent via share link"
												: "Only you can view and use this agent"}
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={async (checked) => {
												field.onChange(checked);
												try {
													if (checked) {
														await agentService.publish(agent.id!);
														alert("Agent published successfully!");
													} else {
														await agentService.unpublish(agent.id!);
														alert("Agent unpublished successfully!");
													}
													setAgent({ ...agent, public: checked });
												} catch (_error) {
													// Revert on failure
													field.onChange(!checked);
													alert(
														"Failed to update visibility. Please try again.",
													);
												}
											}}
											disabled={!isEditing}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					)}
				</div>

				<div className="border border-border rounded-lg p-6">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<Wrench className="h-5 w-5 text-foreground" />
							<div>
								<h2 className="text-lg font-semibold text-foreground">Tools</h2>
								<p className="text-sm text-muted-foreground">
									Configure tool integrations and settings
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="outline"
							disabled={!isEditing}
							onClick={() => setIsToolModalOpen(true)}
						>
							<Wrench className="h-4 w-4 mr-2" />
							Manage Tools ({agent.tools?.length || 0})
						</Button>
					</div>

					{/* Selected Tools Preview */}
					{agent.tools && agent.tools.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{agent.tools.map((tool: string) => (
								<div
									key={tool}
									className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm"
								>
									<span className="text-foreground">{tool}</span>
									<button
										type="button"
										disabled={!isEditing}
										onClick={() => {
											const updatedTools =
												agent.tools?.filter((t: string) => t !== tool) || [];
											setAgent({ ...agent, tools: updatedTools });
										}}
										className={`transition-colors ${
											isEditing
												? "text-muted-foreground hover:text-foreground"
												: "text-muted-foreground/50 cursor-not-allowed"
										}`}
										aria-label={`Remove ${tool}`}
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							))}
						</div>
					)}

					{(!agent.tools || agent.tools.length === 0) && (
						<p className="text-sm text-muted-foreground">
							No tools selected. Click "Manage Tools" to add tools.
						</p>
					)}
				</div>

				<div className="border border-border rounded-lg p-6">
					<div className="flex items-center gap-3 mb-6">
						<Users className="h-5 w-5 text-foreground" />
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								SubAgents
							</h2>
							<p className="text-sm text-muted-foreground">
								Select agents to work as subagents for this agent
							</p>
						</div>
					</div>

					{/* Selected Subagents */}
					{agent.subagents && agent.subagents.length > 0 && (
						<div className="mb-6">
							<h3 className="text-sm font-medium text-foreground mb-3">
								Selected Subagents ({agent.subagents.length})
							</h3>
							<div className="flex flex-wrap gap-2">
								{agent.subagents.map((subagent: Agent) => (
									<div
										key={subagent.id}
										className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm"
									>
										<span className="text-foreground">{subagent.name}</span>
										<button
											type="button"
											disabled={!isEditing}
											onClick={() => toggleSubagent(subagent)}
											className={`transition-colors ${
												isEditing
													? "text-muted-foreground hover:text-foreground"
													: "text-muted-foreground/50 cursor-not-allowed"
											}`}
											aria-label={`Remove ${subagent.name}`}
										>
											<X className="h-3 w-3" />
										</button>
									</div>
								))}
							</div>
						</div>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
						{filteredSubagents.map((ag: Agent) => {
							const isSelected = isAgentSelected(ag.id!);
							return (
								<div
									key={ag.id}
									className={`border rounded-lg p-4 transition-all relative ${
										isEditing
											? "cursor-pointer hover:shadow-md"
											: "cursor-default opacity-80"
									} ${
										isSelected
											? "border-primary bg-primary/10 hover:bg-primary/15"
											: "bg-muted/50 hover:bg-muted"
									}`}
									onClick={() => isEditing && toggleSubagent(ag)}
									tabIndex={isEditing ? 0 : -1}
									role="button"
									aria-pressed={isSelected}
									aria-disabled={!isEditing}
								>
									{/* Selection indicator */}
									<div
										className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
											isSelected
												? "bg-primary text-primary-foreground"
												: "bg-muted border border-border"
										}`}
									>
										{isSelected ? (
											<Check className="h-3 w-3" />
										) : (
											<div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
										)}
									</div>

									<div className="flex items-start justify-between mb-2 pr-8">
										<h3 className="text-base font-semibold text-foreground line-clamp-1">
											{ag.name}
										</h3>
									</div>

									{ag.tools && ag.tools.length > 0 && (
										<div className="flex flex-wrap gap-1 mb-2">
											{ag.tools.slice(0, 2).map((tool) => (
												<span
													key={tool}
													className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
												>
													{tool}
												</span>
											))}
											{ag.tools.length > 2 && (
												<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
													+{ag.tools.length - 2} more
												</span>
											)}
										</div>
									)}

									<p className="text-sm text-muted-foreground mb-1 line-clamp-2">
										{ag.description}
									</p>
									{ag.prompt && (
										<p className="text-xs text-foreground/80 mb-1 line-clamp-2 italic">
											{ag.prompt}
										</p>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</form>

			{/* Fullscreen System Message Dialog */}
			<Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
				<DialogContent className="max-w-[99vw] max-h-[99vh] h-[99vh] w-[99vw] flex flex-col">
					<DialogHeader className="flex-shrink-0">
						<DialogTitle className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Computer className="h-5 w-5" />
								System Message Editor
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={!isEditing}
								onClick={toggleUrlMode}
								className="flex items-center gap-2"
							>
								{isUsingUrl ? (
									<ToggleRight className="h-4 w-4" />
								) : (
									<ToggleLeft className="h-4 w-4" />
								)}
								{isUsingUrl ? "URL Mode" : "Manual Mode"}
							</Button>
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 flex-1 min-h-0">
						{isUsingUrl && (
							<div className="flex gap-2 flex-shrink-0">
								<div className="flex-1">
									<Input
										value={systemMessageUrl}
										onChange={(e) => setSystemMessageUrl(e.target.value)}
										placeholder="Enter URL (e.g., GitHub Gist raw URL, text file URL...)"
										className="w-full"
									/>
								</div>
								<Button
									type="button"
									onClick={fetchSystemMessageFromUrl}
									disabled={
										isLoadingFromUrl || !systemMessageUrl.trim() || !isEditing
									}
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
						)}
						<div className="flex-1 min-h-0 h-full">
							{isUsingUrl && isLoadingFromUrl ? (
								<div className="h-full w-full flex items-center justify-center bg-muted rounded-md">
									<p className="text-muted-foreground">
										Loading content from URL...
									</p>
								</div>
							) : (
								<div className="h-full w-full">
									<MonacoEditor
										value={fullscreenSystemMessage}
										handleChange={handleFullscreenSystemMessageChange}
										language="markdown"
										height="100%"
										options={{
											wordWrap: "on",
											minimap: false,
											fontSize: 12,
											lineNumbers: "on",
										}}
									/>
								</div>
							)}
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
								onClick={saveFullscreenSystemMessage}
								className="flex items-center gap-2"
								disabled={!fullscreenSystemMessage.trim() || !isEditing}
							>
								<Save className="h-4 w-4" />
								Save Changes
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Tool Selection Modal */}
			<ToolSelectionModal
				isOpen={isToolModalOpen}
				onClose={() => setIsToolModalOpen(false)}
				initialSelectedTools={agent.tools || []}
				initialMcpConfig={agent.mcp as Record<string, any>}
				initialA2aConfig={agent.a2a as Record<string, any>}
			/>

			{/* Prompt Selection Modal */}
			<PromptSelectionModal
				isOpen={isPromptModalOpen}
				onClose={() => setIsPromptModalOpen(false)}
				onSelect={(prompt) => {
					setSelectedPrompt(prompt);
					if (promptMode === "instructions") {
						form.setValue("instructions", prompt.content);
					} else {
						form.setValue("systemMessage", prompt.content);
					}
				}}
			/>
		</Form>
	);
}
