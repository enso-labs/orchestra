import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { Server, Loader2, Plug, CheckCircle2, XCircle } from "lucide-react";

import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	McpServerConfig,
	McpServerCreate,
	McpServerUpdate,
	McpServerTestConnectionResponse,
} from "@/lib/entities";
import useServer from "@/hooks/useServer";

const serverFormSchema = z.object({
	name: z.string().min(2, { message: "Name must be at least 2 characters." }),
	url: z.string().url({ message: "Must be a valid URL." }),
	transport: z.enum(["sse", "streamable_http"], {
		required_error: "Select a transport type.",
	}),
	config: z.string().optional(),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

interface ServerFormProps {
	server?: McpServerConfig | null;
	onSuccess?: (server: McpServerConfig) => void;
	onCancel?: () => void;
}

export function ServerForm({ server, onSuccess, onCancel }: ServerFormProps) {
	const isEditMode = !!server;
	const { handleCreateServer, handleUpdateServer, handleTestConnection } =
		useServer();

	const [testResult, setTestResult] =
		useState<McpServerTestConnectionResponse | null>(null);
	const [isTesting, setIsTesting] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<ServerFormValues>({
		resolver: zodResolver(serverFormSchema),
		defaultValues: {
			name: server?.name || "",
			url: server?.url || "",
			transport: server?.transport || "sse",
			config: server?.config ? JSON.stringify(server.config, null, 2) : "",
		},
	});

	const parseConfig = (configStr: string): Record<string, any> | null => {
		if (!configStr.trim()) return null;
		try {
			return JSON.parse(configStr);
		} catch {
			return null;
		}
	};

	const onSubmit = async (values: ServerFormValues) => {
		setIsSubmitting(true);
		try {
			let config: Record<string, any> | null = null;
			if (values.config?.trim()) {
				config = parseConfig(values.config);
				if (config === null) {
					form.setError("config", { message: "Invalid JSON." });
					setIsSubmitting(false);
					return;
				}
			}

			if (isEditMode && server) {
				const updates: McpServerUpdate = {
					name: values.name,
					url: values.url,
					transport: values.transport,
					config,
				};
				const updated = await handleUpdateServer(server.id, updates);
				if (updated && onSuccess) onSuccess(updated);
			} else {
				const create: McpServerCreate = {
					name: values.name,
					url: values.url,
					transport: values.transport,
					config,
				};
				const created = await handleCreateServer(create);
				if (created && onSuccess) onSuccess(created);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const onTestConnection = async () => {
		const url = form.getValues("url");
		const transport = form.getValues("transport");
		const configStr = form.getValues("config");

		const urlValidation = z.string().url().safeParse(url);
		if (!urlValidation.success) {
			form.setError("url", { message: "Enter a valid URL to test." });
			return;
		}

		setIsTesting(true);
		setTestResult(null);
		try {
			let config: Record<string, any> | undefined;
			if (configStr?.trim()) {
				const parsed = parseConfig(configStr);
				if (parsed) config = parsed;
			}
			const result = await handleTestConnection({
				url,
				transport,
				config: config || undefined,
			});
			setTestResult(result);
		} finally {
			setIsTesting(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input placeholder="My MCP Server" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="url"
					render={({ field }) => (
						<FormItem>
							<FormLabel>URL</FormLabel>
							<FormControl>
								<Input placeholder="https://mcp.example.com/sse" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="transport"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Transport</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select transport" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="sse">SSE</SelectItem>
									<SelectItem value="streamable_http">
										Streamable HTTP
									</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="config"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Config (JSON, optional)</FormLabel>
							<FormControl>
								<Textarea
									placeholder='{"headers": {"x-api-key": "your-key"}}'
									className="font-mono text-sm min-h-[100px]"
									{...field}
								/>
							</FormControl>
							<p className="text-xs text-muted-foreground">
								Optional JSON config (e.g. headers, authentication).
							</p>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Test Connection */}
				<div className="flex items-center gap-3">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onTestConnection}
						disabled={isTesting}
					>
						{isTesting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Testing...
							</>
						) : (
							<>
								<Plug className="h-4 w-4 mr-2" />
								Test Connection
							</>
						)}
					</Button>
					{testResult && (
						<div className="flex items-center gap-2 text-sm">
							{testResult.success ? (
								<>
									<CheckCircle2 className="h-4 w-4 text-green-500" />
									<span className="text-green-600">
										{testResult.message}
										{testResult.tools_count != null &&
											` (${testResult.tools_count} tools)`}
									</span>
								</>
							) : (
								<>
									<XCircle className="h-4 w-4 text-destructive" />
									<span className="text-destructive">{testResult.message}</span>
								</>
							)}
						</div>
					)}
				</div>

				{/* Actions */}
				<div className="flex justify-end gap-2 pt-2">
					{onCancel && (
						<Button type="button" variant="outline" onClick={onCancel}>
							Cancel
						</Button>
					)}
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								{isEditMode ? "Updating..." : "Creating..."}
							</>
						) : (
							<>
								<Server className="h-4 w-4 mr-2" />
								{isEditMode ? "Update Server" : "Create Server"}
							</>
						)}
					</Button>
				</div>
			</form>
		</Form>
	);
}
