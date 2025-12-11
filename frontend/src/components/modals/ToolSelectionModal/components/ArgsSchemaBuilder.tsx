import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Plus, X, ChevronRight, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

export interface ArgField {
	type: "str" | "int" | "bool" | "float" | "object" | "array";
	description: string;
	required: boolean;
	default?: any;
	properties?: Record<string, ArgField>;
	items?: ArgField;
}

interface ArgsSchemaBuilderProps {
	schema: Record<string, ArgField>;
	onChange: (schema: Record<string, ArgField>) => void;
}

// Internal representation with stable IDs
interface ParamEntry {
	id: string;
	name: string;
	field: ArgField;
}

interface SchemaRowProps {
	id: string;
	name: string;
	field: ArgField;
	onUpdate: (field: ArgField) => void;
	onRemove: () => void;
	onNameChange: (newName: string) => void;
	depth?: number;
}

// Generate unique IDs
let idCounter = 0;
function generateId(): string {
	return `param_${Date.now()}_${++idCounter}`;
}

function SchemaRow({
	id,
	name,
	field,
	onUpdate,
	onRemove,
	onNameChange,
	depth = 0,
}: SchemaRowProps) {
	const [isExpanded, setIsExpanded] = useState(true);
	// Track property IDs for nested objects
	const [propertyIds] = useState<Map<string, string>>(() => new Map());

	const getPropertyId = useCallback((propName: string): string => {
		if (!propertyIds.has(propName)) {
			propertyIds.set(propName, generateId());
		}
		return propertyIds.get(propName)!;
	}, [propertyIds]);

	const handleTypeChange = (value: ArgField["type"]) => {
		onUpdate({
			...field,
			type: value,
			// Reset nested structures if type changes
			properties: value === "object" ? {} : undefined,
			items: value === "array" ? { type: "str", description: "", required: false } : undefined,
		});
	};

	const handleAddProperty = () => {
		const newPropName = `new_param_${Object.keys(field.properties || {}).length + 1}`;
		// Pre-generate ID for the new property
		propertyIds.set(newPropName, generateId());
		const newProps = {
			...(field.properties || {}),
			[newPropName]: {
				type: "str" as const,
				description: "",
				required: true,
			},
		};
		onUpdate({ ...field, properties: newProps });
	};

	const handleUpdateProperty = (propName: string, newProp: ArgField) => {
		onUpdate({
			...field,
			properties: {
				...(field.properties || {}),
				[propName]: newProp,
			},
		});
	};

	const handleRemoveProperty = (propName: string) => {
		const newProps = { ...(field.properties || {}) };
		delete newProps[propName];
		propertyIds.delete(propName);
		onUpdate({ ...field, properties: newProps });
	};

	const handleRenameProperty = (oldName: string, newName: string) => {
		if (oldName === newName) return;
		const props = { ...(field.properties || {}) };
		const prop = props[oldName];
		delete props[oldName];
		props[newName] = prop;
		// Transfer the ID to the new name
		const existingId = propertyIds.get(oldName);
		if (existingId) {
			propertyIds.delete(oldName);
			propertyIds.set(newName, existingId);
		}
		onUpdate({ ...field, properties: props });
	};

	const handleUpdateItems = (newItems: ArgField) => {
		onUpdate({ ...field, items: newItems });
	};

	return (
		<div className="space-y-2">
			<div className="flex items-start gap-2">
				{/* Indentation/Collapse */}
				<div
					className="flex items-center justify-center w-6 h-10 flex-shrink-0"
					style={{ marginLeft: `${depth * 16}px` }}
				>
					{(field.type === "object" || field.type === "array") ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-6 w-6 p-0"
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
						</Button>
					) : (
						<div className="w-6" />
					)}
				</div>

				<div className="flex-1 grid grid-cols-12 gap-2">
					{/* Name */}
					<div className="col-span-3">
						<Input
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
							placeholder="Name"
							disabled={depth > 0 && name === "items"} // Items schema doesn't have a name key
							className="h-9"
						/>
					</div>

					{/* Type */}
					<div className="col-span-2">
						<Select value={field.type} onValueChange={handleTypeChange}>
							<SelectTrigger className="h-9">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="str">String</SelectItem>
								<SelectItem value="int">Integer</SelectItem>
								<SelectItem value="float">Float</SelectItem>
								<SelectItem value="bool">Boolean</SelectItem>
								<SelectItem value="object">Object</SelectItem>
								<SelectItem value="array">Array</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Description */}
					<div className="col-span-5">
						<Input
							value={field.description}
							onChange={(e) => onUpdate({ ...field, description: e.target.value })}
							placeholder="Description"
							className="h-9"
						/>
					</div>

					{/* Required & Actions */}
					<div className="col-span-2 flex items-center justify-end gap-2">
						<div className="flex items-center gap-1" title="Required">
							<span className="text-xs text-muted-foreground">Req</span>
							<Switch
								checked={field.required}
								onCheckedChange={(c) => onUpdate({ ...field, required: c })}
							/>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={onRemove}
							className="h-8 w-8 text-muted-foreground hover:text-destructive"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Nested Object Properties */}
			{isExpanded && field.type === "object" && field.properties && (
				<div className="border-l-2 border-muted ml-4 pl-0">
					{Object.entries(field.properties).map(([propName, propField]) => (
						<SchemaRow
							key={getPropertyId(propName)}
							id={getPropertyId(propName)}
							name={propName}
							field={propField}
							onUpdate={(updated) => handleUpdateProperty(propName, updated)}
							onRemove={() => handleRemoveProperty(propName)}
							onNameChange={(newName) => handleRenameProperty(propName, newName)}
							depth={depth + 1}
						/>
					))}
					<div className="ml-10 pt-1">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleAddProperty}
							className="h-7 text-xs"
						>
							<Plus className="h-3 w-3 mr-1" />
							Add Property
						</Button>
					</div>
				</div>
			)}

			{/* Nested Array Items */}
			{isExpanded && field.type === "array" && field.items && (
				<div className="border-l-2 border-muted ml-4 pl-0 pt-2">
					<div className="ml-8 text-xs text-muted-foreground mb-1">Array Items Schema:</div>
					<SchemaRow
						id={`${id}_items`}
						name="items"
						field={field.items}
						onUpdate={handleUpdateItems}
						onRemove={() => {}} // Cannot remove items schema from array
						onNameChange={() => {}} // Name is fixed
						depth={depth + 1}
					/>
				</div>
			)}
		</div>
	);
}

export function ArgsSchemaBuilder({ schema, onChange }: ArgsSchemaBuilderProps) {
	// Track stable IDs for each parameter by maintaining an internal array representation
	const [params, setParams] = useState<ParamEntry[]>(() =>
		Object.entries(schema).map(([name, field]) => ({
			id: generateId(),
			name,
			field,
		}))
	);

	// Sync with external schema changes (e.g., on initial load or reset)
	const prevSchemaRef = useRef<Record<string, ArgField>>(schema);
	useEffect(() => {
		// Only sync if schema changed externally (not from our own updates)
		const schemaKeys = Object.keys(schema).sort().join(',');
		const paramKeys = params.map(p => p.name).sort().join(',');
		const prevKeys = Object.keys(prevSchemaRef.current).sort().join(',');

		// Check if this is an external change by comparing key structure
		if (schemaKeys !== paramKeys && schemaKeys !== prevKeys) {
			setParams(Object.entries(schema).map(([name, field]) => ({
				id: generateId(),
				name,
				field,
			})));
		}
		prevSchemaRef.current = schema;
	}, [schema, params]);

	// Convert internal params back to schema and call onChange
	const emitChange = useCallback((newParams: ParamEntry[]) => {
		const newSchema: Record<string, ArgField> = {};
		for (const param of newParams) {
			newSchema[param.name] = param.field;
		}
		prevSchemaRef.current = newSchema;
		setParams(newParams);
		onChange(newSchema);
	}, [onChange]);

	const addParameter = () => {
		const newParamName = `param_${params.length + 1}`;
		emitChange([
			...params,
			{
				id: generateId(),
				name: newParamName,
				field: {
					type: "str",
					description: "",
					required: true,
				},
			},
		]);
	};

	const updateParameter = (id: string, field: ArgField) => {
		emitChange(params.map(p => p.id === id ? { ...p, field } : p));
	};

	const removeParameter = (id: string) => {
		emitChange(params.filter(p => p.id !== id));
	};

	const renameParameter = (id: string, newName: string) => {
		emitChange(params.map(p => p.id === id ? { ...p, name: newName } : p));
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<label className="text-sm font-medium">Input Parameters (args_schema)</label>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={addParameter}
				>
					<Plus className="h-4 w-4 mr-2" />
					Add Parameter
				</Button>
			</div>

			<div className="space-y-4">
				{params.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
						No parameters defined. Click "Add Parameter" to define inputs.
					</div>
				) : (
					params.map((param) => (
						<SchemaRow
							key={param.id}
							id={param.id}
							name={param.name}
							field={param.field}
							onUpdate={(f) => updateParameter(param.id, f)}
							onRemove={() => removeParameter(param.id)}
							onNameChange={(n) => renameParameter(param.id, n)}
						/>
					))
				)}
			</div>
		</div>
	);
}
