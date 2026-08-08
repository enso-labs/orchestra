import { useState, useCallback } from "react";
import { Schedule, ScheduleCreate } from "@/lib/entities/schedule";
import ScheduleService from "@/lib/services/scheduleService";
import { toast } from "sonner";
import {
	isNetworkError,
	notifyConnectionLost,
} from "@/lib/utils/connectionToast";

/**
 * Stable ids for the two load-failure toasts. Both fire from mount effects, so
 * a single outage (or one StrictMode double-mount) would otherwise stack a
 * toast per hook instance. Sonner replaces by id, collapsing them into one.
 *
 * Deliberately NOT applied to create/update/delete: those answer a specific
 * Save/Delete click and must fire once per click, every click.
 */
export const AGENT_SCHEDULES_LOAD_TOAST_ID = "agent-schedules-load";
export const AGENT_SCHEDULE_LOAD_TOAST_ID = "agent-schedule-load";

interface FetchSchedulesOptions {
	/**
	 * Suppress load-failure notifications. Used by the post-write refreshes so
	 * a refetch failure cannot render "Failed to load schedules" beside the
	 * success toast for a write that actually succeeded.
	 */
	silent?: boolean;
}

export const useAgentSchedules = (agentId?: string) => {
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchSchedules = useCallback(
		async (options?: FetchSchedulesOptions) => {
			if (!agentId) return;

			setLoading(true);
			setError(null);
			try {
				const response = await ScheduleService.getAgentSchedules(agentId);
				setSchedules(response.schedules);
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to fetch schedules";
				setError(errorMessage);
				if (options?.silent) return;
				// See useSchedules — outage toasts share one id and collapse.
				if (isNetworkError(err)) notifyConnectionLost();
				else
					toast.error("Failed to load schedules", {
						id: AGENT_SCHEDULES_LOAD_TOAST_ID,
					});
			} finally {
				setLoading(false);
			}
		},
		[agentId],
	);

	const createSchedule = useCallback(
		async (schedule: ScheduleCreate) => {
			// Without an agent there is nothing to POST to. Returning silently
			// here used to leave the caller reporting success for a write that
			// never happened — say so, and throw so the caller's error path runs.
			if (!agentId) {
				const message = "Cannot create schedule: no agent selected";
				setError(message);
				toast.error(message);
				throw new Error(message);
			}

			setLoading(true);
			try {
				await ScheduleService.createAgentSchedule(agentId, schedule);
				toast.success("Schedule created successfully");
				// Silent: the write already reported its own outcome. A refetch
				// failure toasting here would sit beside the success toast.
				await fetchSchedules({ silent: true });
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to create schedule";
				setError(errorMessage);
				toast.error("Failed to create schedule");
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[agentId, fetchSchedules],
	);

	const updateSchedule = useCallback(
		async (scheduleId: string, schedule: ScheduleCreate) => {
			// Same as createSchedule — a silent no-op here reads as success.
			if (!agentId) {
				const message = "Cannot update schedule: no agent selected";
				setError(message);
				toast.error(message);
				throw new Error(message);
			}

			setLoading(true);
			try {
				await ScheduleService.updateAgentSchedule(
					agentId,
					scheduleId,
					schedule,
				);
				toast.success("Schedule updated successfully");
				// Silent: the write already reported its own outcome. A refetch
				// failure toasting here would sit beside the success toast.
				await fetchSchedules({ silent: true });
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to update schedule";
				setError(errorMessage);
				toast.error("Failed to update schedule");
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[agentId, fetchSchedules],
	);

	const deleteSchedule = useCallback(
		async (scheduleId: string) => {
			setLoading(true);
			try {
				await ScheduleService.deleteSchedule(scheduleId);
				toast.success("Schedule deleted successfully");
				// Silent: the write already reported its own outcome. A refetch
				// failure toasting here would sit beside the success toast.
				await fetchSchedules({ silent: true });
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to delete schedule";
				setError(errorMessage);
				toast.error("Failed to delete schedule");
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchSchedules],
	);

	const getSchedule = useCallback(async (scheduleId: string) => {
		setLoading(true);
		try {
			const response = await ScheduleService.getSchedule(scheduleId);
			return response.schedule;
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to fetch schedule";
			setError(errorMessage);
			if (isNetworkError(err)) notifyConnectionLost();
			else
				toast.error("Failed to load schedule", {
					id: AGENT_SCHEDULE_LOAD_TOAST_ID,
				});
			throw err;
		} finally {
			setLoading(false);
		}
	}, []);

	return {
		schedules,
		loading,
		error,
		fetchSchedules,
		createSchedule,
		updateSchedule,
		deleteSchedule,
		getSchedule,
	};
};
