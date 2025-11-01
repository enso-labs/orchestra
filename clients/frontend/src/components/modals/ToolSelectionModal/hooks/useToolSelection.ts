import { useState } from "react";

export function useToolSelection(initialTools: string[] = []) {
	const [selectedTools, setSelectedTools] = useState<Set<string>>(
		new Set(initialTools),
	);

	const toggleTool = (toolName: string) => {
		setSelectedTools((prev) => {
			const next = new Set(prev);
			if (next.has(toolName)) {
				next.delete(toolName);
			} else {
				next.add(toolName);
			}
			return next;
		});
	};

	const clearSelection = () => setSelectedTools(new Set());

	const selectMultiple = (tools: string[]) => {
		setSelectedTools(new Set([...selectedTools, ...tools]));
	};

	const isSelected = (toolName: string) => selectedTools.has(toolName);

	return {
		selectedTools,
		toggleTool,
		clearSelection,
		selectMultiple,
		isSelected,
		selectedCount: selectedTools.size,
		selectedArray: Array.from(selectedTools),
	};
}
