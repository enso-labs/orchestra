import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Loader2, AlertTriangle, Terminal } from "lucide-react";
import { ArgField } from "./ArgsSchemaBuilder";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import MonacoEditor from "@/components/inputs/MonacoEditor";
import JsonView from "@uiw/react-json-view";

interface ToolTestPanelProps {
	argsSchema: Record<string, ArgField>;
	onInvoke: (args: Record<string, any>) => void;
	isLoading: boolean;
	result?: any;
	error?: string;
	isConfigValid: boolean;
}

export function ToolTestPanel({
	argsSchema,
	onInvoke,
	isLoading,
	result,
	error,
	isConfigValid,
}: ToolTestPanelProps) {
	const [args, setArgs] = useState<Record<string, any>>({});

	// Initialize default values when schema changes
	useEffect(() => {
		const defaults: Record<string, any> = {};
		Object.entries(argsSchema).forEach(([name, field]) => {
			if (field.default !== undefined) {
				defaults[name] = field.default;
			}
		});
		setArgs((prev) => ({ ...defaults, ...prev }));
	}, [argsSchema]);

	const handleArgChange = (name: string, value: any) => {
		setArgs((prev) => ({ ...prev, [name]: value }));
	};

	return (
		<div className="space-y-4 border rounded-lg p-4 bg-muted/30">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Terminal className="h-4 w-4 text-muted-foreground" />
					<h3 className="text-sm font-medium">Test Tool</h3>
				</div>
				<Button
					onClick={() => onInvoke(args)}
					disabled={isLoading || !isConfigValid}
					size="sm"
					variant="secondary"
					className="h-8"
				>
					{isLoading ? (
						<Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
					) : (
						<Play className="h-3.5 w-3.5 mr-2" />
					)}
					Invoke
				</Button>
			</div>

			{!isConfigValid && (
				<Alert variant="destructive" className="py-2 text-xs">
					<AlertTriangle className="h-3 w-3" />
					<AlertTitle className="text-xs font-semibold ml-2">
						Configuration Incomplete
					</AlertTitle>
					<AlertDescription className="text-xs ml-2">
						Please enter a valid Base URL and Endpoint to test this tool.
					</AlertDescription>
				</Alert>
			)}

			<div className="grid gap-3">
				{Object.entries(argsSchema).length === 0 ? (
					<div className="text-xs text-muted-foreground italic border border-dashed rounded px-3 py-2">
						No parameters defined. Click Invoke to test without arguments.
					</div>
				) : (
					<div className="space-y-3 bg-background rounded-md border p-3">
						<Label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
							Arguments
						</Label>
						{Object.entries(argsSchema).map(([name, field]) => (
							<div key={name} className="grid grid-cols-12 gap-2 items-start">
								<div className="col-span-3 pt-2">
									<Label
										className="text-xs font-medium truncate block"
										title={name}
									>
										{name}
										{field.required && (
											<span className="text-destructive-accent ml-0.5">*</span>
										)}
									</Label>
									<span className="text-[10px] text-muted-foreground font-mono opacity-70">
										{field.type}
									</span>
								</div>
								<div className="col-span-9">
									<InputRenderer
										field={field}
										value={args[name]}
										onChange={(val) => handleArgChange(name, val)}
									/>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{(result || error) && (
				<div className="mt-4 space-y-2">
					<Label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
						Result
					</Label>
					<div
						className={`
						rounded-md border font-mono text-xs overflow-auto max-h-[400px] shadow-sm
						${error ? "bg-destructive/5 border-destructive-accent/70 text-foreground p-3" : "bg-card text-foreground"}
					`}
					>
						{error ? (
							<div className="flex items-start gap-2">
								<AlertTriangle
									aria-hidden="true"
									className="h-4 w-4 flex-shrink-0 mt-0.5 text-destructive-accent"
								/>
								<pre className="whitespace-pre-wrap">{error}</pre>
							</div>
						) : typeof result === "object" && result !== null ? (
							<JsonView
								value={result}
								displayDataTypes={false}
								style={{ padding: "12px", backgroundColor: "transparent" }}
							/>
						) : (
							<pre className="whitespace-pre-wrap p-3">{String(result)}</pre>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function InputRenderer({
	field,
	value,
	onChange,
}: {
	field: ArgField;
	value: any;
	onChange: (val: any) => void;
}) {
	// Handle undefined value
	const val = value === undefined ? "" : value;

	if (field.type === "bool") {
		return (
			<div className="flex items-center h-9">
				<Switch checked={!!val} onCheckedChange={onChange} />
				<span className="ml-2 text-xs text-muted-foreground">
					{val ? "True" : "False"}
				</span>
			</div>
		);
	}

	if (field.type === "int" || field.type === "float") {
		return (
			<Input
				type="number"
				step={field.type === "float" ? "any" : "1"}
				value={val}
				onChange={(e) => {
					const num =
						field.type === "int"
							? parseInt(e.target.value)
							: parseFloat(e.target.value);
					onChange(isNaN(num) ? "" : num);
				}}
				placeholder={`Enter ${field.type}...`}
				className="h-9 font-mono text-xs"
			/>
		);
	}

	if (field.type === "object" || field.type === "array") {
		return (
			<JsonInput
				value={val}
				onChange={onChange}
				placeholder={`Enter ${field.type} JSON...`}
			/>
		);
	}

	// Default string
	return (
		<Input
			value={val}
			onChange={(e) => onChange(e.target.value)}
			placeholder="Enter text..."
			className="h-9 text-xs"
		/>
	);
}

function JsonInput({
	value,
	onChange,
}: {
	value: any;
	onChange: (val: any) => void;
	placeholder?: string;
}) {
	const [text, setText] = useState(() => {
		try {
			return typeof value === "string" ? value : JSON.stringify(value, null, 2);
		} catch {
			return "";
		}
	});

	// Sync from prop if it changes externally
	useEffect(() => {
		if (value === undefined) return;
		try {
			const currentParsed = JSON.parse(text);
			// Deep compare approximate
			if (JSON.stringify(currentParsed) !== JSON.stringify(value)) {
				setText(JSON.stringify(value, null, 2));
			}
		} catch {
			// ignore
		}
	}, [value]);

	const handleChange = (val: string) => {
		setText(val);
		try {
			const parsed = JSON.parse(val);
			onChange(parsed);
		} catch {
			// Invalid JSON, don't update parent
		}
	};

	return (
		<div className="h-[200px] border rounded-md overflow-hidden bg-background">
			<MonacoEditor
				value={text}
				handleChange={handleChange}
				language="json"
				height="100%"
				options={{
					minimap: false,
					lineNumbers: "off",
					fontSize: 11,
					wordWrap: "on",
					tabSize: 2,
				}}
			/>
		</div>
	);
}
