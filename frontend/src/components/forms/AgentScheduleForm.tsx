import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CronBuilder } from "./CronBuilder";
import { Agent } from "@/lib/services/agentService";
import { ScheduleCreate, ScheduleFormData } from "@/lib/entities/schedule";
import { validateCronExpression } from "@/lib/utils/schedule";
import { Bot, Clock, MessageSquare, Settings, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const scheduleFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().optional(),
	enabled: z.boolean().default(true),
	cronExpression: z.string().min(1, "Schedule is required"),
	message: z.string().min(1, "Message is required"),
	inheritFromAgent: z.boolean().default(true),
	customModel: z.string().optional(),
	customSystem: z.string().optional(),
	customTools: z.array(z.string()).optional(),
});

interface AgentScheduleFormProps {
	agent: Agent;
	onSubmit: (schedule: ScheduleCreate) => Promise<void>;
	onCancel: () => void;
	initialData?: Partial<ScheduleFormData>;
	isLoading?: boolean;
}

export const AgentScheduleForm: React.FC<AgentScheduleFormProps> = ({
	agent,
	onSubmit,
	onCancel,
	initialData,
	isLoading = false,
}) => {
	const [cronError, setCronError] = useState<string>("");

	const form = useForm({
		resolver: zodResolver(scheduleFormSchema),
		defaultValues: {
			name: initialData?.name || "",
			description: initialData?.description || "",
			enabled: initialData?.enabled ?? true,
			cronExpression: initialData?.cronExpression || "0 9 * * *",
			message: initialData?.message || "",
			inheritFromAgent: initialData?.inheritFromAgent ?? true,
			customModel: initialData?.customModel || agent.model,
			customSystem: initialData?.customSystem || agent.prompt,
			customTools: initialData?.customTools || agent.tools,
		},
	});

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors },
	} = form;
	const watchInheritFromAgent = watch("inheritFromAgent");
	const watchCronExpression = watch("cronExpression");

	const handleCronChange = (expression: string) => {
		setValue("cronExpression", expression);
		const error = validateCronExpression(expression);
		setCronError(error);
	};

	const handleFormSubmit = async (data: any) => {
		const cronValidationError = validateCronExpression(data.cronExpression);
		if (cronValidationError) {
			setCronError(cronValidationError);
			return;
		}

		const scheduleData: ScheduleCreate = {
			title: data.name,
			trigger: {
				type: "cron",
				expression: data.cronExpression,
			},
			task: {
				model: data.inheritFromAgent
					? agent.model
					: data.customModel || agent.model,
				system: data.inheritFromAgent
					? agent.prompt
					: data.customSystem || agent.prompt,
				messages: [
					{
						role: "user",
						content: data.message,
					},
				],
				tools: data.inheritFromAgent ? agent.tools : data.customTools || [],
				a2a: agent.a2a,
				mcp: agent.mcp,
				subagents: agent.subagents,
				metadata: {
					...agent.metadata,
					schedule_description: data.description,
					inherited_from_agent: data.inheritFromAgent,
					enabled: data.enabled,
				},
			},
		};

		await onSubmit(scheduleData);
	};

	return (
		<form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
			{/* Agent Context - Always Visible */}
			<Card className="border-l-4 border-l-primary bg-primary/5">
				<CardContent className="p-4">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-start gap-3 flex-1">
							<div className="p-2 bg-primary/10 rounded-lg">
								<Bot className="h-5 w-5 text-primary" />
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1">
									<h3 className="font-semibold text-lg truncate">{agent.name}</h3>
									<Badge variant="secondary" className="shrink-0">
										{agent.model}
									</Badge>
								</div>
								<p className="text-sm text-muted-foreground line-clamp-2">
									{agent.prompt && agent.prompt.length > 100
										? `${agent.prompt.substring(0, 100)}...`
										: agent.prompt || "No prompt configured"}
								</p>
								{agent.tools && agent.tools.length > 0 && (
									<div className="flex flex-wrap gap-1 mt-2">
										<span className="text-xs text-muted-foreground mr-1">Tools:</span>
										{agent.tools.slice(0, 4).map((tool, index) => (
											<Badge
												key={index}
												variant="outline"
												className="text-xs"
											>
												{tool}
											</Badge>
										))}
										{agent.tools.length > 4 && (
											<Badge variant="outline" className="text-xs">
												+{agent.tools.length - 4} more
											</Badge>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
					<div className="mt-3 pt-3 border-t">
						<p className="text-xs text-muted-foreground">
							This schedule will run automatically using the configuration above.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Progress Indicator */}
			<div className="flex items-center justify-center gap-2 py-2">
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
						<span className="text-xs font-semibold text-primary">1</span>
					</div>
					<span className="text-xs font-medium text-muted-foreground hidden sm:inline">Details</span>
				</div>
				<div className="h-px w-8 bg-border" />
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded-full bg-muted border-2 border-border flex items-center justify-center">
						<span className="text-xs font-semibold text-muted-foreground">2</span>
					</div>
					<span className="text-xs font-medium text-muted-foreground hidden sm:inline">When</span>
				</div>
				<div className="h-px w-8 bg-border" />
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded-full bg-muted border-2 border-border flex items-center justify-center">
						<span className="text-xs font-semibold text-muted-foreground">3</span>
					</div>
					<span className="text-xs font-medium text-muted-foreground hidden sm:inline">What</span>
				</div>
			</div>

			{/* Basic Information */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
								<MessageSquare className="h-4 w-4 text-primary" />
							</div>
							<div>
								<CardTitle className="text-lg">Schedule Details</CardTitle>
								<CardDescription className="text-xs mt-0.5">
									Name and describe this scheduled task
								</CardDescription>
							</div>
						</div>
						<Badge variant="outline" className="text-xs">Step 1</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<Label htmlFor="name">Name *</Label>
							<Input
								id="name"
								{...register("name")}
								placeholder="Daily weather check"
								className={errors.name ? "border-destructive" : ""}
							/>
							{errors.name && (
								<p className="text-sm text-destructive mt-1">
									{errors.name.message}
								</p>
							)}
						</div>
						<div className="flex items-center space-x-2">
							<Switch
								id="enabled"
								checked={watch("enabled")}
								onCheckedChange={(checked) => setValue("enabled", checked)}
							/>
							<Label htmlFor="enabled">Enabled</Label>
						</div>
					</div>
					<div>
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							{...register("description")}
							placeholder="Optional description of what this schedule does"
							rows={2}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Schedule Timing */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
								<Clock className="h-4 w-4 text-primary" />
							</div>
							<div>
								<CardTitle className="text-lg">When to Run</CardTitle>
								<CardDescription className="text-xs mt-0.5">
									Set the schedule timing (minimum: 1 hour intervals)
								</CardDescription>
							</div>
						</div>
						<Badge variant="outline" className="text-xs">Step 2</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<CronBuilder
						value={watchCronExpression}
						onChange={handleCronChange}
						error={cronError || errors.cronExpression?.message}
					/>
				</CardContent>
			</Card>

			{/* Task Configuration */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
								<Bot className="h-4 w-4 text-primary" />
							</div>
							<div>
								<CardTitle className="text-lg">What to Execute</CardTitle>
								<CardDescription className="text-xs mt-0.5">
									Define the task and configuration mode
								</CardDescription>
							</div>
						</div>
						<Badge variant="outline" className="text-xs">Step 3</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Configuration Mode Selector */}
					<div className="space-y-3">
						<div className="flex items-start justify-between">
							<div>
								<Label className="text-base font-semibold">Configuration Mode</Label>
								<p className="text-sm text-muted-foreground mt-1">
									Choose how this schedule should use agent settings
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							{/* Use Agent Settings Option */}
							<button
								type="button"
								onClick={() => setValue("inheritFromAgent", true)}
								className={cn(
									"relative p-4 rounded-lg border-2 text-left transition-all",
									watchInheritFromAgent
										? "border-primary bg-primary/5 shadow-sm"
										: "border-border hover:border-primary/50 hover:bg-accent/50"
								)}
							>
								<div className="flex items-start gap-3">
									<div className={cn(
										"p-2 rounded-md shrink-0",
										watchInheritFromAgent ? "bg-primary/10" : "bg-muted"
									)}>
										<Bot className={cn(
											"h-4 w-4",
											watchInheritFromAgent ? "text-primary" : "text-muted-foreground"
										)} />
									</div>
									<div className="flex-1">
										<div className="font-medium mb-1">Use Agent Settings</div>
										<p className="text-xs text-muted-foreground">
											Inherit model, prompt, and tools from <span className="font-medium">{agent.name}</span>
										</p>
									</div>
									{watchInheritFromAgent && (
										<div className="absolute top-2 right-2">
											<div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
												<Check className="h-3 w-3 text-primary-foreground" />
											</div>
										</div>
									)}
								</div>
							</button>

							{/* Custom Configuration Option */}
							<button
								type="button"
								onClick={() => setValue("inheritFromAgent", false)}
								className={cn(
									"relative p-4 rounded-lg border-2 text-left transition-all",
									!watchInheritFromAgent
										? "border-primary bg-primary/5 shadow-sm"
										: "border-border hover:border-primary/50 hover:bg-accent/50"
								)}
							>
								<div className="flex items-start gap-3">
									<div className={cn(
										"p-2 rounded-md shrink-0",
										!watchInheritFromAgent ? "bg-primary/10" : "bg-muted"
									)}>
										<Settings className={cn(
											"h-4 w-4",
											!watchInheritFromAgent ? "text-primary" : "text-muted-foreground"
										)} />
									</div>
									<div className="flex-1">
										<div className="font-medium mb-1">Custom Configuration</div>
										<p className="text-xs text-muted-foreground">
											Override with different model, prompt, or tools
										</p>
									</div>
									{!watchInheritFromAgent && (
										<div className="absolute top-2 right-2">
											<div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
												<Check className="h-3 w-3 text-primary-foreground" />
											</div>
										</div>
									)}
								</div>
							</button>
						</div>
					</div>

					{/* Agent Settings Preview */}
					{watchInheritFromAgent && (
						<div className="rounded-lg border bg-card">
							<div className="p-3 border-b bg-muted/50">
								<div className="flex items-center gap-2">
									<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
									<span className="text-sm font-medium">Active Agent Configuration</span>
								</div>
							</div>
							<div className="p-4 space-y-3">
								<div className="grid grid-cols-[100px_1fr] gap-3 items-start">
									<span className="text-sm font-medium text-muted-foreground">Model</span>
									<div className="flex items-center gap-2">
										<Badge variant="secondary" className="font-mono">
											{agent.model}
										</Badge>
									</div>
								</div>
								<Separator />
								<div className="grid grid-cols-[100px_1fr] gap-3 items-start">
									<span className="text-sm font-medium text-muted-foreground">System</span>
									<p className="text-sm text-foreground">
										{agent.prompt && agent.prompt.length > 150
											? `${agent.prompt.substring(0, 150)}...`
											: agent.prompt || "No system prompt configured"}
									</p>
								</div>
								{agent.tools && agent.tools.length > 0 && (
									<>
										<Separator />
										<div className="grid grid-cols-[100px_1fr] gap-3 items-start">
											<span className="text-sm font-medium text-muted-foreground">Tools</span>
											<div className="flex flex-wrap gap-2">
												{agent.tools.map((tool, index) => (
													<Badge
														key={index}
														variant="outline"
														className="text-xs font-mono"
													>
														{tool}
													</Badge>
												))}
											</div>
										</div>
									</>
								)}
							</div>
							<div className="px-4 py-3 bg-muted/30 border-t rounded-b-lg">
								<p className="text-xs text-muted-foreground flex items-start gap-2">
									<Info className="h-3 w-3 mt-0.5 shrink-0" />
									Any changes to <span className="font-medium">{agent.name}</span> will automatically apply to this schedule
								</p>
							</div>
						</div>
					)}

					{/* Custom Settings */}
					{!watchInheritFromAgent && (
						<div className="space-y-4">
							<Separator />
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<Label htmlFor="customModel">Model</Label>
									<Input
										id="customModel"
										{...register("customModel")}
										placeholder={agent.model}
									/>
								</div>
								<div>
									<Label htmlFor="customTools">Tools (comma-separated)</Label>
									<Input
										id="customTools"
										placeholder={agent.tools?.join(", ") || "No tools"}
										onChange={(e) => {
											const tools = e.target.value
												.split(",")
												.map((t) => t.trim())
												.filter(Boolean);
											setValue("customTools", tools);
										}}
									/>
								</div>
							</div>
							<div>
								<Label htmlFor="customSystem">System Prompt</Label>
								<Textarea
									id="customSystem"
									{...register("customSystem")}
									placeholder={agent.prompt}
									rows={4}
								/>
							</div>
						</div>
					)}

					<Separator />

					{/* Message */}
					<div>
						<Label htmlFor="message">Message *</Label>
						<Textarea
							id="message"
							{...register("message")}
							placeholder="What should the agent do? e.g., 'Check the weather in Dallas and send a summary'"
							rows={3}
							className={errors.message ? "border-destructive" : ""}
						/>
						{errors.message && (
							<p className="text-sm text-destructive mt-1">
								{errors.message.message}
							</p>
						)}
						<p className="text-sm text-muted-foreground mt-1">
							This message will be sent to the agent when the schedule runs
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Form Actions */}
			<div className="flex justify-end gap-3">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={isLoading || !!cronError}>
					{isLoading ? "Creating..." : "Create Schedule"}
				</Button>
			</div>
		</form>
	);
};
