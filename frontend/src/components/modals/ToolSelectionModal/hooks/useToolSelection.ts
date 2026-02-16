import { useState, useEffect } from "react";
import { useAgentContext } from "@/context/AgentContext";

export function useToolSelection(initialTools: string[] = []) {
	const { setAgentTools } = useAgentContext();
	const [selectedTools, setSelectedTools] = useState<Set<string>>(
		new Set(initialTools),
	);

	// Sync selection when initialTools changes (e.g., default tools added after mount)
	useEffect(() => {
		if (initialTools.length > 0) {
			setSelectedTools(new Set(initialTools));
		}
	}, [initialTools.join(",")]);

	const toggleTool = (toolName: string) => {
		setSelectedTools((prev) => {
			const next = new Set(prev);
			if (next.has(toolName)) {
				next.delete(toolName);
			} else {
				next.add(toolName);
			}
			setAgentTools(Array.from(next));
			return next;
		});
	};

	const clearSelection = () => setSelectedTools(new Set());

	const selectMultiple = (tools: string[]) => {
		const merged = new Set([...selectedTools, ...tools]);
		setSelectedTools(merged);
		setAgentTools(Array.from(merged));
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
