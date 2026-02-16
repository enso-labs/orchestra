import { useState, useCallback } from "react";
import { Cron, CronCreate } from "@/lib/entities/cron";
import CronService from "@/lib/services/cronService";
import { toast } from "sonner";

export const useSchedules = () => {
	const [schedules, setSchedules] = useState<Cron[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchSchedules = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await CronService.getAllCrons();
			setSchedules(response.crons);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to fetch schedules";
			setError(errorMessage);
			toast.error("Failed to load schedules");
		} finally {
			setLoading(false);
		}
	}, []);

	const createSchedule = useCallback(
		async (schedule: CronCreate) => {
			setLoading(true);
			try {
				await CronService.createCron(schedule);
				toast.success("Schedule created successfully");
				await fetchSchedules(); // Refresh the list
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
		async (scheduleId: string, schedule: CronCreate) => {
			setLoading(true);
			try {
				await CronService.updateCron(scheduleId, schedule);
				toast.success("Schedule updated successfully");
				await fetchSchedules(); // Refresh the list
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
				await CronService.deleteCron(scheduleId);
				toast.success("Schedule deleted successfully");
				await fetchSchedules(); // Refresh the list
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
			const response = await CronService.getCron(scheduleId);
			return response.cron;
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to fetch schedule";
			setError(errorMessage);
			toast.error("Failed to load schedule");
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
