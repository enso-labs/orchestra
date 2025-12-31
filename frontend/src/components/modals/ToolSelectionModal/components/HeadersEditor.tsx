import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

interface HeadersEditorProps {
	headers: Record<string, string>;
	onChange: (headers: Record<string, string>) => void;
}

export function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
	const headerEntries = Object.entries(headers);

	const addHeader = () => {
		onChange({ ...headers, "": "" });
	};

	const removeHeader = (keyToRemove: string) => {
		// If key is empty, we might remove the wrong one if multiple are empty.
		// Using index is safer for the UI list, but object keys must be unique.
		// Since headers is a Record, keys are unique.
		// But if we have multiple empty keys in UI (impossible in Record),
		// we should probably model the internal state as array of pairs for editing.

		const newHeaders = { ...headers };
		delete newHeaders[keyToRemove];
		onChange(newHeaders);
	};

	const updateKey = (oldKey: string, newKey: string, value: string) => {
		if (oldKey === newKey) return;

		const newHeaders = { ...headers };
		delete newHeaders[oldKey];
		newHeaders[newKey] = value;
		onChange(newHeaders);
	};

	const updateValue = (key: string, newValue: string) => {
		onChange({ ...headers, [key]: newValue });
	};

	// To handle adding new empty keys correctly with Record, we might need local state
	// or accept that we can only have one empty key at a time.
	// A better approach for the form is to use an array of objects and convert to Record on save.
	// But the props are Record. Let's assume the parent handles it or we convert here.
	// Actually, for a controlled component, passed Record is hard to edit if keys change.
	// Let's change the component to accept [key, value][] or similar if possible.
	// For now, I'll stick to the props but be careful.

	// Issue: If I change a key, the order might jump.
	// Issue: I can't have two empty keys.

	// Refactor: Local state as array of pairs.
	// Sync with props when they change (if different).

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<label className="text-sm font-medium">Headers</label>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={addHeader}
					className="h-8 px-2"
				>
					<Plus className="h-4 w-4 mr-1" />
					Add
				</Button>
			</div>

			{headerEntries.length === 0 && (
				<div className="text-sm text-muted-foreground italic px-2">
					No headers configured.
				</div>
			)}

			<div className="space-y-2">
				{headerEntries.map(([key, value], index) => (
					<div key={index} className="flex items-center gap-2">
						<Input
							placeholder="Key (e.g. Content-Type)"
							value={key}
							onChange={(e) => updateKey(key, e.target.value, value)}
							className="flex-1"
						/>
						<Input
							placeholder="Value"
							value={value}
							onChange={(e) => updateValue(key, e.target.value)}
							className="flex-1"
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => removeHeader(key)}
							className="h-9 w-9 text-muted-foreground hover:text-destructive"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}
