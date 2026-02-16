import { useState, useCallback } from "react";
import { Cron, CronCreate } from "@/lib/entities/cron";
import CronService from "@/lib/services/cronService";
import { toast } from "sonner";

export const useCrons = () => {
	const [crons, setCrons] = useState<Cron[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchCrons = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await CronService.getAllCrons();
			setCrons(response.crons);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to fetch crons";
			setError(errorMessage);
			toast.error("Failed to load crons");
		} finally {
			setLoading(false);
		}
	}, []);

	const createCron = useCallback(
		async (cron: CronCreate) => {
			setLoading(true);
			try {
				await CronService.createCron(cron);
				toast.success("Cron created successfully");
				await fetchCrons(); // Refresh the list
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to create cron";
				setError(errorMessage);
				toast.error("Failed to create cron");
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchCrons],
	);

	const updateCron = useCallback(
		async (cronId: string, cron: CronCreate) => {
			setLoading(true);
			try {
				await CronService.updateCron(cronId, cron);
				toast.success("Cron updated successfully");
				await fetchCrons(); // Refresh the list
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to update cron";
				setError(errorMessage);
				toast.error("Failed to update cron");
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchCrons],
	);

	const deleteCron = useCallback(
		async (cronId: string) => {
			setLoading(true);
			try {
				await CronService.deleteCron(cronId);
				toast.success("Cron deleted successfully");
				await fetchCrons(); // Refresh the list
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to delete cron";
				setError(errorMessage);
				toast.error("Failed to delete cron");
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[fetchCrons],
	);

	const getCron = useCallback(async (cronId: string) => {
		setLoading(true);
		try {
			const response = await CronService.getCron(cronId);
			return response.cron;
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to fetch cron";
			setError(errorMessage);
			toast.error("Failed to load cron");
			throw err;
		} finally {
			setLoading(false);
		}
	}, []);

	return {
		crons,
		loading,
		error,
		fetchCrons,
		createCron,
		updateCron,
		deleteCron,
		getCron,
	};
};
