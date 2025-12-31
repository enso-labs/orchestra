import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { ApiToolPayload } from "./hooks/useCustomTools";
import { HeadersEditor } from "./components/HeadersEditor";
import { ArgsSchemaBuilder, ArgField } from "./components/ArgsSchemaBuilder";
import { ToolTestPanel } from "./components/ToolTestPanel";
import { invokeTool } from "@/lib/services/toolService";

interface ApiToolFormProps {
	initialData?: Partial<ApiToolPayload>;
	onSave: (data: ApiToolPayload) => Promise<void>;
	onCancel: () => void;
	mode: "create" | "edit" | "duplicate";
}

export function ApiToolForm({
	initialData,
	onSave,
	onCancel,
	mode,
}: ApiToolFormProps) {
	const [name, setName] = useState(initialData?.name || "");
	const [description, setDescription] = useState(initialData?.description || "");
	const [baseUrl, setBaseUrl] = useState(
		initialData?.config?.api_tool?.base_url || "",
	);
	const [method, setMethod] = useState(
		initialData?.config?.api_tool?.method || "GET",
	);
	const [endpoint, setEndpoint] = useState(
		initialData?.config?.api_tool?.endpoint || "",
	);
	const [headers, setHeaders] = useState<Record<string, string>>(
		initialData?.config?.api_tool?.headers || {},
	);
	const [argsSchema, setArgsSchema] = useState<Record<string, ArgField>>(
		(initialData?.config?.api_tool?.args_schema as Record<string, ArgField>) || {},
	);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Test state
	const [testResult, setTestResult] = useState<any>(undefined);
	const [testError, setTestError] = useState<string | undefined>(undefined);
	const [isTestLoading, setIsTestLoading] = useState(false);

	const handleInvoke = async (testArgs: Record<string, any>) => {
		setIsTestLoading(true);
		setTestResult(undefined);
		setTestError(undefined);
		try {
			const config = {
				api_tool: {
					base_url: baseUrl,
					method,
					endpoint,
					headers: Object.keys(headers).length > 0 ? headers : undefined,
					args_schema: Object.keys(argsSchema).length > 0 ? argsSchema : undefined,
				},
			};
			// Use a temporary name if not provided
			const toolName = name.trim() || "ephemeral_tool";
			const result = await invokeTool(toolName, testArgs, config);
			setTestResult(result);
		} catch (err: any) {
			console.error("Test invocation failed:", err);
			setTestError(err.message || "Invocation failed");
		} finally {
			setIsTestLoading(false);
		}
	};


	const validate = () => {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) newErrors.name = "Name is required";
		if (!/^[a-z0-9_]+$/.test(name)) {
			newErrors.name = "Name must be snake_case (lowercase, numbers, underscores)";
		}
		
		if (!baseUrl.trim()) newErrors.baseUrl = "Base URL is required";
		if (!/^https?:\/\//.test(baseUrl)) {
			newErrors.baseUrl = "Base URL must start with http:// or https://";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		setIsSubmitting(true);
		try {
			const payload: ApiToolPayload = {
				name,
				description,
				type: "api",
				tags: ["api_tool"],
				config: {
					api_tool: {
						base_url: baseUrl,
						method,
						endpoint,
						headers: Object.keys(headers).length > 0 ? headers : undefined,
						args_schema: Object.keys(argsSchema).length > 0 ? argsSchema : undefined,
					},
				},
			};
			await onSave(payload);
		} catch (error) {
			// Error handled by parent (toast)
		} finally {
			setIsSubmitting(false);
		}
	};

	const title =
		mode === "create"
			? "Create New Tool"
			: mode === "edit"
				? `Edit: ${name}`
				: "Duplicate Tool";

	return (
		<div className="flex flex-col h-full overflow-hidden bg-background">
			{/* Header */}
			<div className="flex-shrink-0 border-b border-border px-6 py-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon" onClick={onCancel}>
						<ArrowLeft className="h-5 w-5" />
					</Button>
					<h2 className="text-xl font-semibold">{title}</h2>
				</div>
				<Button onClick={handleSubmit} disabled={isSubmitting} className="min-w-[140px]">
					{isSubmitting ? (
						<span className="animate-spin mr-2">⏳</span>
					) : (
						<Save className="h-4 w-4 mr-2" />
					)}
					{mode === "edit" ? "Update Tool" : "Create Tool"}
				</Button>
			</div>

			{/* Form Content */}
			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-3xl mx-auto space-y-8">
					{/* Basic Info */}
					<div className="space-y-4">
						<h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
						
						<div className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium">Tool Name</label>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="my_api_tool"
									disabled={mode === "edit"}
									className={errors.name ? "border-destructive" : ""}
								/>
								{errors.name && (
									<p className="text-xs text-destructive">{errors.name}</p>
								)}
								{mode !== "edit" && (
									<p className="text-xs text-muted-foreground">
										Must be snake_case (e.g. get_weather)
									</p>
								)}
							</div>
							
							<div className="space-y-2">
								<label className="text-sm font-medium">Description</label>
								<Textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="What does this tool do? Provide detailed instructions..."
									rows={3}
									className="resize-y"
								/>
							</div>
						</div>
					</div>

					{/* API Configuration */}
					<div className="space-y-4">
						<h3 className="text-lg font-medium border-b pb-2">API Configuration</h3>
						
						{/* URL Builder - Method + Base URL inline */}
						<div className="space-y-2">
							<label className="text-sm font-medium">Request URL</label>
							<div className="flex">
								<Select value={method} onValueChange={setMethod}>
									<SelectTrigger className="w-24 rounded-r-none border-r-0 flex-shrink-0">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="GET">GET</SelectItem>
										<SelectItem value="POST">POST</SelectItem>
										<SelectItem value="PUT">PUT</SelectItem>
										<SelectItem value="DELETE">DELETE</SelectItem>
										<SelectItem value="PATCH">PATCH</SelectItem>
									</SelectContent>
								</Select>
								<Input
									value={baseUrl}
									onChange={(e) => setBaseUrl(e.target.value)}
									placeholder="https://api.example.com"
									className={`rounded-l-none flex-1 ${errors.baseUrl ? "border-destructive" : ""}`}
								/>
							</div>
							{errors.baseUrl && (
								<p className="text-xs text-destructive">{errors.baseUrl}</p>
							)}
						</div>
						
						{/* Optional Endpoint */}
						<div className="space-y-2">
							<label className="text-sm font-medium">
								Endpoint <span className="text-muted-foreground font-normal">(optional)</span>
							</label>
							<Input
								value={endpoint}
								onChange={(e) => setEndpoint(e.target.value)}
								placeholder="/v1/resource"
							/>
							<p className="text-xs text-muted-foreground">
								Appended to Base URL. Leave empty if full path is in Base URL.
							</p>
						</div>

						<HeadersEditor headers={headers} onChange={setHeaders} />
					</div>

					{/* Arguments Schema */}
					<div className="space-y-4">
						<h3 className="text-lg font-medium border-b pb-2">Parameters</h3>
						<p className="text-sm text-muted-foreground">
							Define the input parameters the agent will provide when calling this tool.
						</p>
						<ArgsSchemaBuilder schema={argsSchema} onChange={setArgsSchema} />
					</div>

					{/* Test Tool */}
					<div className="pt-6">
						<ToolTestPanel
							argsSchema={argsSchema}
							onInvoke={handleInvoke}
							isLoading={isTestLoading}
							result={testResult}
							error={testError}
							isConfigValid={!!(baseUrl && endpoint)}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

