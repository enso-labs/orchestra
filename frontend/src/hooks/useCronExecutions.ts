import { useCallback, useEffect, useRef, useState } from "react";
import CronService from "@/lib/services/cronService";
import { CronExecution } from "@/lib/entities/cron";

interface UseCronExecutionsOptions {
	cronId?: string;
	limit?: number;
	autoRefresh?: boolean;
	refreshInterval?: number;
}

export function useCronExecutions(options: UseCronExecutionsOptions = {}) {
	const {
		cronId,
		limit = 20,
		autoRefresh = false,
		refreshInterval = 30000,
	} = options;

	const [executions, setExecutions] = useState<CronExecution[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchRecentExecutions = useCallback(
		async (fetchLimit?: number) => {
			setLoading(true);
			setError(null);
			try {
				const data = await CronService.getRecentExecutions(fetchLimit ?? limit);
				// Ensure data is an array before setting
				setExecutions(Array.isArray(data) ? data : []);
			} catch (err) {
				const message = "Failed to fetch recent executions";
				setError(message);
				// Don't show toast for expected 404 (endpoint may not exist yet)
				console.error(message, err);
				setExecutions([]);
			} finally {
				setLoading(false);
			}
		},
		[limit],
	);

	const fetchCronExecutions = useCallback(
		async (id: string, fetchLimit?: number) => {
			setLoading(true);
			setError(null);
			try {
				const data = await CronService.getCronExecutions(
					id,
					fetchLimit ?? limit,
				);
				// Ensure data is an array before setting
				setExecutions(Array.isArray(data) ? data : []);
			} catch (err) {
				const message = "Failed to fetch cron executions";
				setError(message);
				console.error(message, err);
				setExecutions([]);
			} finally {
				setLoading(false);
			}
		},
		[limit],
	);

	const fetchExecutionsByDateRange = useCallback(
		async (startDate: string, endDate: string) => {
			setLoading(true);
			setError(null);
			try {
				const data = await CronService.getExecutionsByDateRange(
					startDate,
					endDate,
				);
				// Ensure data is an array before setting
				setExecutions(Array.isArray(data) ? data : []);
			} catch (err) {
				const message = "Failed to fetch executions by date range";
				setError(message);
				console.error(message, err);
				setExecutions([]);
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	// Initial fetch on mount
	useEffect(() => {
		if (cronId) {
			fetchCronExecutions(cronId);
		} else {
			fetchRecentExecutions();
		}
	}, [cronId, fetchCronExecutions, fetchRecentExecutions]);

	// Auto-refresh interval
	useEffect(() => {
		if (!autoRefresh) return;

		const fetch = () => {
			if (cronId) {
				fetchCronExecutions(cronId);
			} else {
				fetchRecentExecutions();
			}
		};

		intervalRef.current = setInterval(fetch, refreshInterval);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [
		autoRefresh,
		refreshInterval,
		cronId,
		fetchCronExecutions,
		fetchRecentExecutions,
	]);

	return {
		executions,
		loading,
		error,
		fetchRecentExecutions,
		fetchCronExecutions,
		fetchExecutionsByDateRange,
	};
}

export default useCronExecutions;
