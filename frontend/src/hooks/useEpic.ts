import EpicService from "@/lib/services/epicService";
import { Epic, Task } from "@/lib/entities/epic";
import { useEffect, useState } from "react";

export interface EpicState {
	epics: Epic[];
	selectedEpic: Epic | null;
	tasks: Task[];
	loading: boolean;
	error: string | null;
}

export const INIT_EPIC_STATE: EpicState = {
	epics: [],
	selectedEpic: null,
	tasks: [],
	loading: false,
	error: null,
};

export function useEpic() {
	const [epics, setEpics] = useState<Epic[]>([]);
	const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleGetEpics = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await EpicService.search();
			setEpics(response.data.epics || []);
		} catch (err: any) {
			setError(err.message || "Failed to fetch epics");
			console.error("Failed to fetch epics:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateEpic = async (
		epic: Partial<Epic>,
	): Promise<Epic | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await EpicService.create(epic);
			const newEpic = {
				...epic,
				id: response.data.epic_id,
			} as Epic;
			setEpics((prev) => [...prev, newEpic]);
			return newEpic;
		} catch (err: any) {
			setError(err.message || "Failed to create epic");
			console.error("Failed to create epic:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateEpic = async (
		epicId: string,
		updates: Partial<Epic>,
	): Promise<Epic | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await EpicService.update(epicId, updates);
			const updatedEpic = response.data.epic;

			setEpics((prev) =>
				prev.map((e) => (e.id === epicId ? { ...e, ...updatedEpic } : e)),
			);

			if (selectedEpic?.id === epicId) {
				setSelectedEpic({ ...selectedEpic, ...updatedEpic });
			}

			return updatedEpic;
		} catch (err: any) {
			setError(err.message || "Failed to update epic");
			console.error("Failed to update epic:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteEpic = async (epicId: string): Promise<boolean> => {
		setLoading(true);
		setError(null);
		try {
			await EpicService.delete(epicId);
			setEpics((prev) => prev.filter((e) => e.id !== epicId));
			if (selectedEpic?.id === epicId) {
				setSelectedEpic(null);
				setTasks([]);
			}
			return true;
		} catch (err: any) {
			setError(err.message || "Failed to delete epic");
			console.error("Failed to delete epic:", err);
			return false;
		} finally {
			setLoading(false);
		}
	};

	const handleGetTasks = async (epicId: string) => {
		setLoading(true);
		setError(null);
		try {
			const response = await EpicService.listTasks(epicId);
			setTasks(response.data.tasks || []);
		} catch (err: any) {
			setError(err.message || "Failed to fetch tasks");
			console.error("Failed to fetch tasks:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateTask = async (
		epicId: string,
		task: Partial<Task>,
	): Promise<Task | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await EpicService.createTask(epicId, task);
			const newTask = {
				...task,
				id: response.data.task_id,
				epic_id: epicId,
			} as Task;
			setTasks((prev) => [...prev, newTask]);
			return newTask;
		} catch (err: any) {
			setError(err.message || "Failed to create task");
			console.error("Failed to create task:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateTask = async (
		epicId: string,
		taskId: string,
		updates: Partial<Task>,
	): Promise<Task | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await EpicService.updateTask(epicId, taskId, updates);
			const updatedTask = response.data.task;

			setTasks((prev) =>
				prev.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t)),
			);

			return updatedTask;
		} catch (err: any) {
			setError(err.message || "Failed to update task");
			console.error("Failed to update task:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteTask = async (
		epicId: string,
		taskId: string,
	): Promise<boolean> => {
		setLoading(true);
		setError(null);
		try {
			await EpicService.deleteTask(epicId, taskId);
			setTasks((prev) => prev.filter((t) => t.id !== taskId));
			return true;
		} catch (err: any) {
			setError(err.message || "Failed to delete task");
			console.error("Failed to delete task:", err);
			return false;
		} finally {
			setLoading(false);
		}
	};

	const selectEpic = (epic: Epic | null) => {
		setSelectedEpic(epic);
	};

	const useEffectGetEpics = () => {
		useEffect(() => {
			handleGetEpics();
		}, []);

		return () => {
			setEpics([]);
		};
	};

	return {
		epics,
		setEpics,
		selectedEpic,
		selectEpic,
		tasks,
		setTasks,
		loading,
		error,
		handleGetEpics,
		handleCreateEpic,
		handleUpdateEpic,
		handleDeleteEpic,
		handleGetTasks,
		handleCreateTask,
		handleUpdateTask,
		handleDeleteTask,
		useEffectGetEpics,
	};
}

export default useEpic;
