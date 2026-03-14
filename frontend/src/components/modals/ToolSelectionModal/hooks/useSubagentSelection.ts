import { useState, useEffect, useRef, useCallback } from "react";
import { useAgentContext } from "@/context/AgentContext";
import { patchDefaults } from "@/lib/services/userSettingsService";
import { getAuthToken } from "@/lib/utils/auth";
import { toast } from "sonner";
import { Agent } from "@/lib/services/agentService";

export function useSubagentSelection() {
	const { agent, setAgent, agents } = useAgentContext();
	const [selectedIds, setSelectedIds] = useState<Set<string>>(
		new Set(
			(agent.subagents || [])
				.map((s) => s.id)
				.filter((id): id is string => !!id),
		),
	);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sync from agent.subagents when they change externally
	useEffect(() => {
		const ids = (agent.subagents || [])
			.map((s) => s.id)
			.filter((id): id is string => !!id);
		setSelectedIds(new Set(ids));
	}, [agent.subagents]);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const persistSubagents = useCallback((ids: string[]) => {
		if (!getAuthToken()) return;
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			debounceRef.current = null;
			patchDefaults({ subagents: ids }).catch(() =>
				toast.error("Failed to save subagent defaults"),
			);
		}, 500);
	}, []);

	const flushPersist = useCallback(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}
	}, []);

	const toggleSubagent = (targetAgent: Agent) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			const id = targetAgent.id;
			if (!id) return prev;

			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}

			// Update agent.subagents with resolved Agent objects
			const resolved = agents.filter((a) => a.id && next.has(a.id));
			setAgent((prevAgent: Agent) => ({
				...prevAgent,
				subagents: resolved,
			}));

			persistSubagents(Array.from(next));
			return next;
		});
	};

	const isAgentSelected = (agentId: string) => selectedIds.has(agentId);

	return {
		selectedIds,
		toggleSubagent,
		isAgentSelected,
		flushPersist,
	};
}
