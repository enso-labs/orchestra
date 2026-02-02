import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ScheduleService from "@/lib/services/scheduleService";
import { ScheduleExecution } from "@/lib/entities/schedule";

interface UseScheduleExecutionsOptions {
	scheduleId?: string;
	limit?: number;
	autoRefresh?: boolean;
	refreshInterval?: number;
}

export function useScheduleExecutions(
	options: UseScheduleExecutionsOptions = {},
) {
	const {
		scheduleId,
		limit = 20,
		autoRefresh = false,
		refreshInterval = 30000,
	} = options;

	const [executions, setExecutions] = useState<ScheduleExecution[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchRecentExecutions = useCallback(
		async (fetchLimit?: number) => {
			setLoading(true);
			setError(null);
			try {
				const data = await ScheduleService.getRecentExecutions(
					fetchLimit ?? limit,
				);
				setExecutions(Array.isArray(data) ? data : []);
			} catch (err) {
				const message = "Failed to fetch recent executions";
				setError(message);
				toast.error(message);
				console.error(message, err);
			} finally {
				setLoading(false);
			}
		},
		[limit],
	);

	const fetchScheduleExecutions = useCallback(
		async (id: string, fetchLimit?: number) => {
			setLoading(true);
			setError(null);
			try {
				const data = await ScheduleService.getScheduleExecutions(
					id,
					fetchLimit ?? limit,
				);
				setExecutions(Array.isArray(data) ? data : []);
			} catch (err) {
				const message = "Failed to fetch schedule executions";
				setError(message);
				toast.error(message);
				console.error(message, err);
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
				const data = await ScheduleService.getExecutionsByDateRange(
					startDate,
					endDate,
				);
				setExecutions(Array.isArray(data) ? data : []);
			} catch (err) {
				const message = "Failed to fetch executions by date range";
				setError(message);
				toast.error(message);
				console.error(message, err);
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	// Initial fetch on mount
	useEffect(() => {
		if (scheduleId) {
			fetchScheduleExecutions(scheduleId);
		} else {
			fetchRecentExecutions();
		}
	}, [scheduleId, fetchScheduleExecutions, fetchRecentExecutions]);

	// Auto-refresh interval
	useEffect(() => {
		if (!autoRefresh) return;

		const fetch = () => {
			if (scheduleId) {
				fetchScheduleExecutions(scheduleId);
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
		scheduleId,
		fetchScheduleExecutions,
		fetchRecentExecutions,
	]);

	return {
		executions,
		loading,
		error,
		fetchRecentExecutions,
		fetchScheduleExecutions,
		fetchExecutionsByDateRange,
	};
}

export default useScheduleExecutions;
