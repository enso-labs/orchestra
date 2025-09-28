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
} from "lucide-react";

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
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useAgentContext } from "@/context/AgentContext";
import { useEffect, useState } from "react";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import { Button } from "@/components/ui/button";
import agentService, { Agent } from "@/lib/services/agentService";
import SelectModel from "@/components/lists/SelectModel";
import { useNavigate } from "react-router-dom";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	description: z.string().min(2, {
		message: "Description must be at least 2 characters.",
	}),
	systemMessage: z.string().min(2, {
		message: "System message must be at least 2 characters.",
	}),
	model: z.string().min(2, {
		message: "Model must be at least 2 characters.",
	}),
});

export function AgentCreateForm() {
	const navigate = useNavigate();
	const {
		agent,
		setAgent,
		loadMcpTemplate,
		loadA2aTemplate,
		clearMcp,
		clearA2a,
	} = useAgentContext();
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const [fullscreenSystemMessage, setFullscreenSystemMessage] = useState("");
	const [systemMessageUrl, setSystemMessageUrl] = useState("");
	const [isUsingUrl, setIsUsingUrl] = useState(false);
	const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			systemMessage: "",
		},
	});

	const onSubmit = (values: z.infer<typeof formSchema>) => {
		console.log(values);
	};

	const saveConfiguration = async () => {
		const configData: Agent = {
			name: agent.name,
			description: agent.description,
			model: agent.model,
			prompt: agent.system,
			mcp: agent.mcp,
			a2a: agent.a2a,
			tools: agent.tools,
		};
		console.log("Saving agent configuration:", configData);
		await agentService.create(configData);
		alert("Configuration saved! Check console for details.");
	};

	const updateConfiguration = async () => {
		const configData: Agent = {
			id: agent.id,
			name: agent.name,
			description: agent.description,
			model: agent.model,
			prompt: agent.system,
			mcp: agent.mcp,
			a2a: agent.a2a,
			tools: agent.tools,
		};
		console.log("Updating agent configuration:", configData);
		await agentService.update(configData);
		alert("Configuration updated! Check console for details.");
	};

	const deleteAgent = async () => {
		if (!agent.id) return;

		const confirmed = confirm(
			"Are you sure you want to delete this agent? This action cannot be undone.",
		);
		if (!confirmed) return;

		try {
			await agentService.delete(agent.id);
			navigate("/agents");
			// Navigate back to agents list or handle post-delete action
		} catch (error) {
			console.error("Failed to delete agent:", error);
			alert("Failed to delete agent. Please try again.");
		}
	};

	const openFullscreen = () => {
		setFullscreenSystemMessage(agent.system || "");
		setIsFullscreenOpen(true);
	};

	const saveFullscreenSystemMessage = () => {
		setAgent({ ...agent, system: fullscreenSystemMessage });
		form.setValue("systemMessage", fullscreenSystemMessage);
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
		form.setValue("systemMessage", agent.system);
	}, [agent]);

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
									onClick={updateConfiguration}
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
								onClick={saveConfiguration}
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
							name="systemMessage"
							render={({ field }) => (
								<FormItem>
									<div className="flex items-center justify-between">
										<FormLabel>System Message</FormLabel>
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
									<FormControl>
										<Textarea
											{...field}
											onChangeCapture={(e) =>
												setAgent({ ...agent, system: e.currentTarget.value })
											}
										/>
									</FormControl>
									{/* <FormDescription>This is your system message.</FormDescription> */}
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
					<div className="flex items-center gap-3 mb-6">
						<Wrench className="h-5 w-5 text-foreground" />
						<div>
							<h2 className="text-lg font-semibold text-foreground">Tools</h2>
							<p className="text-sm text-muted-foreground">
								Configure tool integrations and settings
							</p>
						</div>
					</div>
					<Accordion type="single" collapsible>
						<AccordionItem value="mcp">
							<AccordionTrigger>MCP</AccordionTrigger>
							<AccordionContent>
								<div className="space-y-4">
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={loadMcpTemplate}
										>
											Load Default Template
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={clearMcp}
										>
											Clear
										</Button>
									</div>
									<MonacoEditor
										value={JSON.stringify(agent.mcp, null, 2)}
										handleChange={(val) =>
											setAgent({ ...agent, mcp: JSON.parse(val) })
										}
									/>
								</div>
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value="a2a">
							<AccordionTrigger>A2A</AccordionTrigger>
							<AccordionContent>
								<div className="space-y-4">
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={loadA2aTemplate}
										>
											Load Default Template
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={clearA2a}
										>
											Clear
										</Button>
									</div>
									<MonacoEditor
										value={JSON.stringify(agent.a2a, null, 2)}
										handleChange={(val) =>
											setAgent({ ...agent, a2a: JSON.parse(val) })
										}
									/>
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>

				{/* <Button type="submit">Submit</Button> */}
			</form>

			{/* Fullscreen System Message Dialog */}
			<Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
				<DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] w-[95vw] flex flex-col">
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
										value={systemMessageUrl}
										onChange={(e) => setSystemMessageUrl(e.target.value)}
										placeholder="Enter URL (e.g., GitHub Gist raw URL, text file URL...)"
										className="w-full"
									/>
								</div>
								<Button
									type="button"
									onClick={fetchSystemMessageFromUrl}
									disabled={isLoadingFromUrl || !systemMessageUrl.trim()}
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
						<div className="flex-1 min-h-0">
							<Textarea
								value={fullscreenSystemMessage}
								onChange={(e) =>
									handleFullscreenSystemMessageChange(e.target.value)
								}
								placeholder={
									isUsingUrl
										? "Content from URL will appear here. Click 'Fetch' to load..."
										: "Enter your system message here. This will define how your AI agent behaves and responds to user inputs..."
								}
								className="h-full w-full resize-none text-sm leading-relaxed"
								readOnly={isUsingUrl && isLoadingFromUrl}
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
		</Form>
	);
}
