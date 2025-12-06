import { useState, useEffect, useCallback } from "react";
import { Tool } from "../types";
import {
	getUserTools,
	createTool,
	deleteTool as deleteToolApi,
} from "@/lib/services/toolService";
import { toast } from "sonner";

export interface ApiToolPayload {
	name: string;
	description: string;
	type: "api";
	config: {
		api_tool: {
			base_url: string;
			method: string;
			endpoint: string;
			args_schema?: Record<string, any>;
			headers?: Record<string, string>;
		};
	};
	tags: string[];
}

export function useCustomTools() {
	const [customTools, setCustomTools] = useState<Tool[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchCustomTools = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const tools = await getUserTools();
			setCustomTools(tools);
		} catch (err: any) {
			console.error("Failed to fetch custom tools:", err);
			setError(err.message || "Failed to load custom tools");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Initial fetch
	useEffect(() => {
		fetchCustomTools();
	}, [fetchCustomTools]);

	const saveTool = async (payload: ApiToolPayload) => {
		try {
			// Backend create overwrites if name exists, effectively supporting edit
			await createTool(payload);
			toast.success(`Tool "${payload.name}" saved successfully`);
			await fetchCustomTools();
		} catch (err: any) {
			console.error("Failed to save tool:", err);
			const msg = err.response?.data?.detail || err.message || "Failed to save tool";
			toast.error(msg);
			throw new Error(msg);
		}
	};

	const deleteTool = async (name: string) => {
		try {
			await deleteToolApi(name);
			toast.success(`Tool "${name}" deleted successfully`);
			await fetchCustomTools();
		} catch (err: any) {
			console.error("Failed to delete tool:", err);
			const msg = err.response?.data?.detail || err.message || "Failed to delete tool";
			toast.error(msg);
			throw new Error(msg);
		}
	};

	const getToolForEdit = (name: string) => {
		return customTools.find((t) => t.name === name);
	};

	const getToolForDuplicate = (tool: Tool): Partial<ApiToolPayload> => {
		// Try to extract config from metadata if available (for custom tools)
		const apiConfig = tool.metadata?.api_config;
		
		if (apiConfig) {
			return {
				description: tool.description,
				type: "api",
				tags: ["custom"],
				config: {
					api_tool: apiConfig
				}
			};
		}
		
		// For platform tools or others without explicit config, 
		// we can't easily duplicate them as API tools yet.
		// Returning empty config will just open a blank form.
		return {
			description: tool.description,
		};
	};

	return {
		customTools,
		isLoading,
		error,
		fetchCustomTools,
		createTool: saveTool,
		deleteTool,
		getToolForEdit,
		getToolForDuplicate,
	};
}

