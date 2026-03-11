import { useEffect, useRef, useState } from "react";
import { getThread } from "@/lib/services/threadService";
import {
	getActiveStreamRecovery,
	removeActiveStreamRecovery,
} from "@/lib/utils/activeStreamRecovery";
import { useChatContext } from "@/context/ChatContext";

type ThreadStreamMetadata = {
	stream_status?: "idle" | "running" | "completed" | "aborted" | "error";
	active_run_id?: string | null;
};

export default function useActiveStreamRecovery(threadId: string | undefined): {
	isRecovering: boolean;
} {
	const { controller, attachToDistributedStream, metadata } = useChatContext();
	const [isRecovering, setIsRecovering] = useState(false);
	const recoveryAttemptedRef = useRef<string | null>(null);

	useEffect(() => {
		if (!threadId || controller) {
			return;
		}

		if (metadata?.thread_id === threadId && metadata?.run_id) {
			return;
		}

		if (recoveryAttemptedRef.current === threadId) {
			return;
		}
		recoveryAttemptedRef.current = threadId;

		let cancelled = false;

		const recover = async () => {
			try {
				const thread = await getThread(threadId);
				if (cancelled) {
					return;
				}

				const threadMetadata = (thread?.metadata ?? {}) as ThreadStreamMetadata;
				const recoveryRecord = getActiveStreamRecovery(threadId);
				const backendRunId = threadMetadata.active_run_id ?? null;

				if (threadMetadata.stream_status !== "running" || !backendRunId) {
					removeActiveStreamRecovery(threadId);
					return;
				}

				if (recoveryRecord && recoveryRecord.runId !== backendRunId) {
					removeActiveStreamRecovery(threadId);
				}

				setIsRecovering(true);
				await attachToDistributedStream({
					threadId,
					runId: backendRunId,
					lastEventId:
						recoveryRecord && recoveryRecord.runId === backendRunId
							? recoveryRecord.lastEventId
							: null,
					route:
						typeof window !== "undefined"
							? window.location.pathname
							: `/thread/${threadId}`,
				});
			} catch {
				removeActiveStreamRecovery(threadId);
			} finally {
				if (!cancelled) {
					setIsRecovering(false);
				}
			}
		};

		void recover();

		return () => {
			cancelled = true;
		};
	}, [
		attachToDistributedStream,
		controller,
		metadata?.run_id,
		metadata?.thread_id,
		threadId,
	]);

	return { isRecovering };
}
