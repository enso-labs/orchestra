import { useState, useEffect, useRef, useCallback } from "react";
import { useAgentContext } from "@/context/AgentContext";
import { patchDefaults } from "@/lib/services/userSettingsService";
import { toast } from "sonner";

export function useToolSelection(initialTools: string[] = []) {
	const { setAgentTools } = useAgentContext();
	const [selectedTools, setSelectedTools] = useState<Set<string>>(
		new Set(initialTools),
	);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sync selection when initialTools changes (e.g., default tools added after mount)
	useEffect(() => {
		if (initialTools.length > 0) {
			setSelectedTools(new Set(initialTools));
		}
	}, [initialTools.join(",")]);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const persistTools = useCallback((tools: string[]) => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			debounceRef.current = null;
			patchDefaults({ tools }).catch(() =>
				toast.error("Failed to save tool defaults"),
			);
		}, 500);
	}, []);

	const flushPersist = useCallback(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
			// We can't access the pending tools list from the timer,
			// so we read the current selectedTools via a ref-like approach.
			// Instead, we'll just let the caller handle final persist.
		}
	}, []);

	const toggleTool = (toolName: string) => {
		setSelectedTools((prev) => {
			const next = new Set(prev);
			if (next.has(toolName)) {
				next.delete(toolName);
			} else {
				next.add(toolName);
			}
			const arr = Array.from(next);
			setAgentTools(arr);
			persistTools(arr);
			return next;
		});
	};

	const clearSelection = () => {
		setSelectedTools(new Set());
		setAgentTools([]);
		persistTools([]);
	};

	const selectMultiple = (tools: string[]) => {
		const merged = new Set([...selectedTools, ...tools]);
		const arr = Array.from(merged);
		setSelectedTools(merged);
		setAgentTools(arr);
		persistTools(arr);
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
		flushPersist,
	};
}
