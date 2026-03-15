import { useState, useCallback, useEffect, useRef } from "react";
import type {
	HeartbeatConfig,
	HeartbeatState,
	HeartbeatTickResult,
} from "@/lib/entities/heartbeat";
import HeartbeatService from "@/lib/services/heartbeatService";
import { toast } from "sonner";

export const useHeartbeat = (autoRefreshMs = 30000) => {
	const [config, setConfig] = useState<HeartbeatConfig | null>(null);
	const [state, setState] = useState<HeartbeatState | null>(null);
	const [history, setHistory] = useState<HeartbeatTickResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchConfig = useCallback(async () => {
		try {
			const response = await HeartbeatService.getConfig();
			setConfig(response.config);
			return response.config;
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Failed to fetch heartbeat config";
			setError(msg);
			return null;
		}
	}, []);

	const fetchState = useCallback(async () => {
		try {
			const s = await HeartbeatService.getState();
			setState(s);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Failed to fetch heartbeat state";
			setError(msg);
		}
	}, []);

	const fetchHistory = useCallback(async () => {
		try {
			const h = await HeartbeatService.getHistory();
			setHistory(h);
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: "Failed to fetch heartbeat history";
			setError(msg);
		}
	}, []);

	const saveConfig = useCallback(
		async (newConfig: Partial<HeartbeatConfig>) => {
			setLoading(true);
			try {
				const saved = await HeartbeatService.upsertConfig(newConfig);
				setConfig(saved);
				toast.success("Heartbeat configuration saved");
				await fetchState();
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: "Failed to save heartbeat config";
				setError(msg);
				toast.error("Failed to save heartbeat configuration");
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchState],
	);

	const deleteConfig = useCallback(async () => {
		setLoading(true);
		try {
			await HeartbeatService.deleteConfig();
			setConfig(null);
			setState(null);
			setHistory([]);
			toast.success("Heartbeat disabled");
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: "Failed to delete heartbeat config";
			setError(msg);
			toast.error("Failed to disable heartbeat");
			throw err;
		} finally {
			setLoading(false);
		}
	}, []);

	const triggerTick = useCallback(async () => {
		setLoading(true);
		try {
			const result = await HeartbeatService.triggerTick();
			toast.success(`Heartbeat tick: ${result.action}`);
			await fetchState();
			await fetchHistory();
			return result;
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Failed to trigger heartbeat tick";
			setError(msg);
			toast.error("Failed to trigger heartbeat tick");
			throw err;
		} finally {
			setLoading(false);
		}
	}, [fetchState, fetchHistory]);

	// Initial load
	useEffect(() => {
		const load = async () => {
			setLoading(true);
			try {
				const cfg = await fetchConfig();
				await fetchState();
				await fetchHistory();
				return cfg;
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [fetchConfig, fetchState, fetchHistory]);

	// Auto-refresh when enabled
	useEffect(() => {
		if (config?.enabled && autoRefreshMs > 0) {
			intervalRef.current = setInterval(() => {
				fetchState();
				fetchHistory();
			}, autoRefreshMs);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [config?.enabled, autoRefreshMs, fetchState, fetchHistory]);

	return {
		config,
		state,
		history,
		loading,
		error,
		fetchConfig,
		fetchState,
		fetchHistory,
		saveConfig,
		deleteConfig,
		triggerTick,
	};
};
