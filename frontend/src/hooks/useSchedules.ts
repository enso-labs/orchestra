import { useState, useCallback } from "react";
import { Schedule, ScheduleCreate } from "@/lib/entities/schedule";
import ScheduleService from "@/lib/services/scheduleService";
import { toast } from "sonner";
import {
	isNetworkError,
	notifyConnectionLost,
} from "@/lib/utils/connectionToast";

/**
 * Stable ids for the two load-failure toasts.
 *
 * Both fire from mount effects, and there is more than one live consumer of
 * this hook at a time (`pages/schedules/index.tsx` plus the sidebar
 * `components/sidebar/panels/SchedulesPanel.tsx`). Without a fixed id a single
 * outage stacks one toast per hook instance — doubled again under StrictMode.
 * Sonner replaces by id, so N concurrent failures render exactly one toast.
 *
 * Deliberately NOT applied to create/update/delete: those are the direct
 * response to a Save/Delete click and must fire once per click, every click.
 */
export const SCHEDULES_LOAD_TOAST_ID = "schedules-load";
export const SCHEDULE_LOAD_TOAST_ID = "schedule-load";

interface FetchSchedulesOptions {
	/**
	 * Suppress load-failure notifications. Used by the post-write refreshes:
	 * a create that succeeded must not render "Failed to load schedules" next
	 * to its own success toast, which reads as though the write failed.
	 */
	silent?: boolean;
}

export const useSchedules = () => {
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchSchedules = useCallback(
		async (options?: FetchSchedulesOptions) => {
			setLoading(true);
			setError(null);
			try {
				const response = await ScheduleService.getAllSchedules();
				setSchedules(response.schedules);
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to fetch schedules";
				setError(errorMessage);
				if (options?.silent) return;
				// A transport failure is an outage, not a schedules problem — route it
				// through the shared toast so concurrent failures collapse into one.
				if (isNetworkError(err)) notifyConnectionLost();
				else
					toast.error("Failed to load schedules", {
						id: SCHEDULES_LOAD_TOAST_ID,
					});
			} finally {
				setLoading(false);
			}
		},
		[],
	);

	const createSchedule = useCallback(
		async (schedule: ScheduleCreate) => {
			setLoading(true);
			try {
				await ScheduleService.createSchedule(schedule);
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
		[fetchSchedules],
	);

	const updateSchedule = useCallback(
		async (scheduleId: string, schedule: ScheduleCreate) => {
			setLoading(true);
			try {
				await ScheduleService.updateSchedule(scheduleId, schedule);
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
		[fetchSchedules],
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
				toast.error("Failed to load schedule", { id: SCHEDULE_LOAD_TOAST_ID });
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
