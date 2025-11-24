import { useEffect, useState } from "react";
import { searchThreads } from "@/lib/services/threadService";

export type ThreadContextType = {
	threads: any[];
	setThreads: (threads: any[]) => void;
	checkpoints: any[];
	setCheckpoints: (checkpoints: any[]) => void;
	checkpoint: any;
	setCheckpoint: (checkpoint: any) => void;
	searchThreads: (
		action: "list_threads" | "list_checkpoints" | "get_checkpoint",
		metadata: { thread_id?: string; checkpoint_id?: string },
	) => void;
	useListThreadsEffect: (trigger?: boolean) => void;
	useListCheckpointsEffect: (
		trigger?: boolean,
		metadata?: { thread_id?: string },
	) => void;
};

export default function useThread(): ThreadContextType {
	const [threads, setThreads] = useState<any[]>([]);
	const [checkpoints, setCheckpoints] = useState<any[]>([]);
	const [checkpoint, setCheckpoint] = useState<any>(null);

	const fetchThreads = async (
		action: "list_threads" | "list_checkpoints" | "get_checkpoint",
		filter: {
			thread_id?: string;
			checkpoint_id?: string;
			assistant_id?: string;
		} = {},
	) => {
		const data = await searchThreads(action, filter);

		if (action === "list_threads") {
			setThreads(data);
		} else if (action === "list_checkpoints") {
			setCheckpoints(data);
		} else if (action === "get_checkpoint") {
			setCheckpoint(data);
		}
	};

	const useListThreadsEffect = (
		trigger?: boolean,
		filter: { assistant_id?: string } = {},
	) => {
		useEffect(() => {
			fetchThreads("list_threads", filter);
		}, [trigger]);
	};

	const useListCheckpointsEffect = (
		trigger?: boolean,
		metadata: { thread_id?: string } = {},
	) => {
		useEffect(() => {
			fetchThreads("list_checkpoints", metadata);
		}, [trigger]);
	};

	return {
		threads,
		setThreads,
		checkpoints,
		setCheckpoints,
		checkpoint,
		setCheckpoint,
		searchThreads,
		useListThreadsEffect,
		useListCheckpointsEffect,
	};
}
