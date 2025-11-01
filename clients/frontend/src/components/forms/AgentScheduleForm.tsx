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
import { Bot, Clock, MessageSquare } from "lucide-react";

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
			{/* Basic Information */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5" />
						Schedule Information
					</CardTitle>
					<CardDescription>
						Basic details about this scheduled task
					</CardDescription>
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
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						Schedule Timing
					</CardTitle>
					<CardDescription>
						When should this task run? (Minimum interval: 1 hour)
					</CardDescription>
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
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Bot className="h-5 w-5" />
						Task Configuration
					</CardTitle>
					<CardDescription>
						Configure what the agent should do when the schedule runs
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Agent Inheritance Toggle */}
					<div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
						<Switch
							id="inheritFromAgent"
							checked={watchInheritFromAgent}
							onCheckedChange={(checked) =>
								setValue("inheritFromAgent", checked)
							}
						/>
						<div className="flex-1">
							<Label htmlFor="inheritFromAgent" className="font-medium">
								Inherit from Agent
							</Label>
							<p className="text-sm text-muted-foreground">
								Use the agent's current model, prompt, and tools
							</p>
						</div>
					</div>

					{/* Agent Settings Preview */}
					{watchInheritFromAgent && (
						<div className="p-3 border rounded-lg bg-secondary/20">
							<h4 className="text-sm font-medium mb-2">Inherited Settings:</h4>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Model:</span>
									<Badge variant="secondary">{agent.model}</Badge>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">System Prompt:</span>
									<span className="text-right max-w-xs truncate">
										{agent.prompt && agent.prompt.length > 50
											? `${agent.prompt.substring(0, 50)}...`
											: agent.prompt || "No prompt configured"}
									</span>
								</div>
								{agent.tools && agent.tools.length > 0 && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Tools:</span>
										<div className="flex flex-wrap gap-1">
											{agent.tools.slice(0, 3).map((tool, index) => (
												<Badge
													key={index}
													variant="outline"
													className="text-xs"
												>
													{tool}
												</Badge>
											))}
											{agent.tools.length > 3 && (
												<Badge variant="outline" className="text-xs">
													+{agent.tools.length - 3}
												</Badge>
											)}
										</div>
									</div>
								)}
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
