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
} from "lucide-react";
import { ToolSelectionModal } from "@/components/modals/ToolSelectionModal";
import { PromptSelectionModal } from "@/components/modals/PromptSelectionModal";
import { PromptModeSelector } from "@/components/forms/PromptModeSelector";

import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useAgentContext } from "@/context/AgentContext";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import agentService, { Agent } from "@/lib/services/agentService";
import SelectModel from "@/components/lists/SelectModel";
import { useNavigate } from "react-router-dom";
import { base64Compare } from "@/lib/utils/format";
import { useParams } from "react-router-dom";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import { Prompt } from "@/lib/entities/prompt";
import { PromptMode, buildPromptPayload, getPromptConfig } from "@/lib/utils/prompt";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	description: z.string(),
	promptContent: z.string().optional(),
	promptMode: z.enum(["instructions", "system_prompt"]),
	model: z.string().min(2, {
		message: "Model must be at least 2 characters.",
	}),
}).superRefine((data, ctx) => {
	if (!data.promptContent?.trim()) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Prompt content is required.",
			path: ["promptContent"],
		});
	}
});

export function AgentCreateForm() {
	const navigate = useNavigate();
	const { agentId } = useParams();
	const { agent, agents, setAgent, toggleSubagent, isAgentSelected } =
		useAgentContext();
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const [fullscreenSystemMessage, setFullscreenSystemMessage] = useState("");
	const [promptContentUrl, setPromptContentUrl] = useState("");
	const [isUsingUrl, setIsUsingUrl] = useState(false);
	const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
	const [isToolModalOpen, setIsToolModalOpen] = useState(false);
	const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
	const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
	const promptDefaults = getPromptConfig(agent);
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			promptContent: promptDefaults.content,
			promptMode: promptDefaults.mode,
			model: "",
		},
	});
	const watchPromptMode = (form.watch("promptMode") ||
		promptDefaults.mode) as PromptMode;
	const watchPromptContent = form.watch("promptContent") || "";

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		const selectedMode: PromptMode =
			selectedPrompt?.type === "system" ? "system_prompt" : values.promptMode;
		// If using saved prompt, store reference; otherwise use custom content
		const promptContent = selectedPrompt
			? `{{prompt:${selectedPrompt.id}:v${selectedPrompt.v}}}`
			: values.promptContent?.trim() || "";
		const promptPayload = buildPromptPayload(selectedMode, promptContent);
		const configData: Agent = {
			name: values.name.trim(),
			description: values.description.trim(),
			model: values.model.trim(),
			...promptPayload,
			// Keep legacy prompt for backward compatibility when using instructions
			prompt: selectedMode === "instructions" ? promptContent : undefined,
			mcp: agent.mcp,
			a2a: agent.a2a,
			tools: agent.tools,
			subagents: agent.subagents,
		};
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
			navigate(`/assistants`);
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
		setFullscreenSystemMessage(watchPromptContent || "");
		setIsFullscreenOpen(true);
	};

	const saveFullscreenSystemMessage = () => {
		handlePromptContentChange(fullscreenSystemMessage);
		setIsFullscreenOpen(false);
	};

	const handleFullscreenSystemMessageChange = (value: string) => {
		setFullscreenSystemMessage(value);
	};

	const fetchSystemMessageFromUrl = async () => {
		if (!promptContentUrl.trim()) {
			alert("Please enter a valid URL");
			return;
		}

		setIsLoadingFromUrl(true);
		try {
			const response = await fetch(promptContentUrl);
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
		const promptConfig = getPromptConfig(agent);
		form.reset({
			name: agent.name,
			description: agent.description,
			promptContent: promptConfig.content,
			promptMode: promptConfig.mode,
			model: agent.model,
		});
		setSelectedPrompt(null);
	}, [agent, form]);

	useEffect(() => {
		if (!selectedPrompt) return;
		const nextMode: PromptMode =
			selectedPrompt.type === "system" ? "system_prompt" : "instructions";
		form.setValue("promptMode", nextMode);
		form.setValue("promptContent", selectedPrompt.content);
	}, [selectedPrompt, form]);

	const agentHasChanged = useMemo(() => {
		const prevAssistant = agents.find((a: Agent) => a.id === agent.id);
		if (!prevAssistant) return true;
		const { system: _legacySystem, ...rest } = agent as any;
		return !base64Compare(JSON.stringify(prevAssistant), JSON.stringify(rest));
	}, [agents, agent]);

	const promptModeBadge =
		watchPromptMode === "system_prompt" ? (
			<Badge variant="destructive">System Prompt Override</Badge>
		) : (
			<Badge variant="secondary">Instructions</Badge>
		);

	const currentPromptHelper =
		watchPromptMode === "system_prompt"
			? "Replace the default Ensō system prompt entirely."
			: "Extend the default Ensō prompt with your own guidance.";

	const handlePromptContentChange = (
		value: string,
		modeOverride?: PromptMode,
	) => {
		form.setValue("promptContent", value);
		const targetMode = modeOverride || watchPromptMode;
		if (targetMode === "system_prompt") {
			setAgent({
				...agent,
				system_prompt: value,
				instructions: undefined,
				prompt: undefined,
			});
		} else {
			setAgent({
				...agent,
				instructions: value,
				system_prompt: undefined,
				prompt: value,
			});
		}
	};

	const handlePromptModeChange = (mode: PromptMode) => {
		form.setValue("promptMode", mode);
		handlePromptContentChange(watchPromptContent, mode);
	};

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
							</div>
						</div>
						{agent.id ? (
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={!agentHasChanged}
									onClick={form.handleSubmit(onSubmit)}
									className="flex items-center gap-2"
								>
									<Pencil className="h-4 w-4" />
									Update
								</Button>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={deleteAgent}
									className="flex items-center gap-2"
								>
									<Trash2 className="h-4 w-4" />
									Delete
								</Button>
							</div>
						) : (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={form.handleSubmit(onSubmit)}
								className="flex items-center gap-2"
							>
								<Save className="h-4 w-4" />
								Save
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
											placeholder="Agent name"
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
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Agent description"
											{...field}
											onChangeCapture={(e) =>
												setAgent({
													...agent,
													description: e.currentTarget.value,
												})
											}
										/>
									</FormControl>
									{/* <FormDescription>This is your agent description.</FormDescription> */}
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="promptContent"
							render={({ field }) => (
								<FormItem>
									<div className="flex items-center justify-between">
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<FormLabel>Prompt Configuration</FormLabel>
												{promptModeBadge}
											</div>
											<p className="text-xs text-muted-foreground">
												{currentPromptHelper}
											</p>
										</div>
										<div className="flex gap-2">
											<Button
												type="button"
												variant="ghost"
												size="sm"
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
									{selectedPrompt && (
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
														{selectedPrompt.type && (
															<Badge
																variant={
																	selectedPrompt.type === "system"
																		? "destructive"
																		: "secondary"
																}
																className="text-xs"
															>
																{selectedPrompt.type}
															</Badge>
														)}
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
														form.setValue("promptContent", "");
													}}
													className="h-6 w-6 p-0 ml-2"
												>
													<X className="h-3 w-3" />
												</Button>
											</div>
										</div>
									)}

									<PromptModeSelector
										mode={watchPromptMode}
										content={field.value || ""}
										onModeChange={handlePromptModeChange}
										onContentChange={(value) => {
											field.onChange(value);
											handlePromptContentChange(value);
										}}
										contentDisabled={!!selectedPrompt}
										showPreviewHint
									/>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="model"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Model</FormLabel>
									<FormControl>
										<SelectModel
											onModelSelected={() => {
												setAgent({ ...agent, model: field.value });
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
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
								<span
									key={tool}
									className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-sm text-foreground"
								>
									{tool}
								</span>
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
											onClick={() => toggleSubagent(subagent)}
											className="text-muted-foreground hover:text-foreground transition-colors"
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
									className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-all relative ${
										isSelected
											? "border-primary bg-primary/10 hover:bg-primary/15"
											: "bg-muted/50 hover:bg-muted"
									}`}
									onClick={() => toggleSubagent(ag)}
									tabIndex={0}
									role="button"
									aria-pressed={isSelected}
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
										value={promptContentUrl}
										onChange={(e) => setPromptContentUrl(e.target.value)}
										placeholder="Enter URL (e.g., GitHub Gist raw URL, text file URL...)"
										className="w-full"
									/>
								</div>
								<Button
									type="button"
									onClick={fetchSystemMessageFromUrl}
									disabled={isLoadingFromUrl || !promptContentUrl.trim()}
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
								disabled={!fullscreenSystemMessage.trim()}
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
				onApply={(selectedTools) => {
					setAgent({ ...agent, tools: selectedTools });
					setIsToolModalOpen(false);
				}}
			/>

			{/* Prompt Selection Modal */}
			<PromptSelectionModal
				isOpen={isPromptModalOpen}
			onClose={() => setIsPromptModalOpen(false)}
			onSelect={(prompt) => {
				setSelectedPrompt(prompt);
				const nextMode: PromptMode =
					prompt.type === "system" ? "system_prompt" : "instructions";
				form.setValue("promptMode", nextMode);
				form.setValue("promptContent", prompt.content);
				if (nextMode === "system_prompt") {
					setAgent({
						...agent,
						system_prompt: prompt.content,
						instructions: undefined,
						prompt: undefined,
					});
				} else {
					setAgent({
						...agent,
						instructions: prompt.content,
						system_prompt: undefined,
						prompt: prompt.content,
					});
				}
			}}
		/>
	</Form>
);
}
