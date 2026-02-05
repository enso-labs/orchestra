import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	Computer,
	Wrench,
	Save,
	Pencil,
	Trash2,
	Users,
	Check,
	X,
	FileText,
	Ban,
	Globe,
	Lock,
	AlertTriangle,
	ArrowRight,
	ExternalLink,
} from "lucide-react";
import { ToolSelectionModal } from "@/components/modals/ToolSelectionModal";

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
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import agentService, { Agent } from "@/lib/services/agentService";
import SelectModel from "@/components/lists/SelectModel";
import { useNavigate, useParams } from "react-router-dom";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	description: z.string(),
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
	const { toBackendFormat, createFile } = useChatContext();
	const [isEditing, setIsEditing] = useState(!agentId);
	const [originalAgent, setOriginalAgent] = useState<Agent | null>(null);
	const [isToolModalOpen, setIsToolModalOpen] = useState(false);
	const [isMigrated, setIsMigrated] = useState(false);
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
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

	useEffect(() => {
		form.setValue("name", agent.name);
		form.setValue("description", agent.description);
		form.setValue("model", agent.model);
		form.setValue("public", agent.public || false);
	}, [agent]);

	const filteredSubagents = agents.filter((a: Agent) => a.id !== agentId);

	// Legacy instructions: show migration card when agent has instructions/system_prompt but no AGENTS.md
	const hasLegacyInstructions =
		!isMigrated &&
		(agent.instructions || agent.system_prompt) &&
		!agent.files?.["AGENTS.md"];
	const legacyContent = agent.instructions || agent.system_prompt || "";

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
						{/* Legacy Instructions Migration Card */}
						{hasLegacyInstructions && (
							<div
								className="flex flex-col gap-3 p-4 border border-amber-500/50 rounded-lg bg-amber-500/10"
							>
								<div className="flex items-start gap-3">
									<AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
									<div className="flex-1">
										<p className="text-sm font-medium text-foreground">
											Legacy Instructions
										</p>
										<p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
											{legacyContent}
										</p>
									</div>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="self-start border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
									onClick={() => {
										createFile("AGENTS.md", legacyContent);
										setIsMigrated(true);
									}}
								>
									<ArrowRight className="h-4 w-4 mr-2" />
									Migrate to AGENTS.md
								</Button>
							</div>
						)}
						{/* AGENTS.md Guidance Note */}
						<div className="flex items-start gap-3 p-4 border border-border rounded-lg bg-muted/50">
							<FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
							<div className="flex-1">
								<div className="flex items-center justify-between">
									<p className="text-sm font-medium text-foreground">
										Agent instructions are now file-based
									</p>
									<a
										href="https://docs.ruska.ai/assistants/agents-md"
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										<ExternalLink className="h-3.5 w-3.5" />
										Learn more
									</a>
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									Create an AGENTS.md file in the file panel to define this
									agent's instructions and system behavior.
								</p>
							</div>
						</div>
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
											onModelSelected={updateQueryStateModel}
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
														await agentService.publish(agent.id);
														alert("Agent published successfully!");
													} else {
														await agentService.unpublish(agent.id);
														alert("Agent unpublished successfully!");
													}
													setAgent({ ...agent, public: checked });
												} catch (error) {
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
		</Form>
	);
}
