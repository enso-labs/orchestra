import { useState, useEffect } from "react";
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
import { ApiToolPayload } from "../hooks/useCustomTools";
import { HeadersEditor } from "./components/HeadersEditor";
import { ArgsSchemaBuilder, ArgField } from "./components/ArgsSchemaBuilder";

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

	// Auto-convert name to snake_case for create/duplicate
	useEffect(() => {
		if (mode === "edit") return;
		
		const snakeCase = name
			.toLowerCase()
			.replace(/\s+/g, "_")
			.replace(/[^a-z0-9_]/g, "");
		
		// Only update if the user typed something different (to allow them to type)
		// Actually, let's just show a preview or validate on submit.
		// A live transform can be annoying.
		// Let's validate on submit.
	}, [name, mode]);

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
				tags: ["custom"],
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
				<Button onClick={handleSubmit} disabled={isSubmitting}>
					{isSubmitting ? (
						<span className="animate-spin mr-2">⏳</span>
					) : (
						<Save className="h-4 w-4 mr-2" />
					)}
					Save Tool
				</Button>
			</div>

			{/* Form Content */}
			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-3xl mx-auto space-y-8">
					{/* Basic Info */}
					<div className="space-y-4">
						<h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
						
						<div className="grid grid-cols-2 gap-4">
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
								<Input
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="What does this tool do?"
								/>
							</div>
						</div>
					</div>

					{/* API Configuration */}
					<div className="space-y-4">
						<h3 className="text-lg font-medium border-b pb-2">API Configuration</h3>
						
						<div className="grid grid-cols-12 gap-4">
							<div className="col-span-2 space-y-2">
								<label className="text-sm font-medium">Method</label>
								<Select value={method} onValueChange={setMethod}>
									<SelectTrigger>
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
							</div>
							
							<div className="col-span-6 space-y-2">
								<label className="text-sm font-medium">Base URL</label>
								<Input
									value={baseUrl}
									onChange={(e) => setBaseUrl(e.target.value)}
									placeholder="https://api.example.com"
									className={errors.baseUrl ? "border-destructive" : ""}
								/>
								{errors.baseUrl && (
									<p className="text-xs text-destructive">{errors.baseUrl}</p>
								)}
							</div>
							
							<div className="col-span-4 space-y-2">
								<label className="text-sm font-medium">Endpoint</label>
								<Input
									value={endpoint}
									onChange={(e) => setEndpoint(e.target.value)}
									placeholder="/v1/resource"
								/>
							</div>
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
				</div>
			</div>
		</div>
	);
}

