import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

type UseInitialThreadRedirectOptions = {
	threadId?: string;
	hasMessages: boolean;
};

export default function useInitialThreadRedirect({
	threadId,
	hasMessages,
}: UseInitialThreadRedirectOptions): void {
	const navigate = useNavigate();
	const lastNavigatedThreadIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!threadId) {
			lastNavigatedThreadIdRef.current = null;
			return;
		}

		if (!hasMessages) {
			return;
		}

		if (lastNavigatedThreadIdRef.current === threadId) {
			return;
		}

		lastNavigatedThreadIdRef.current = threadId;
		navigate(`/thread/${threadId}`, { replace: true });
	}, [hasMessages, navigate, threadId]);
}
