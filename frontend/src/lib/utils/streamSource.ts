import { FetchStreamReader, ResponseBodyReader } from "./fetchStreamReader";
import type { StreamEvent } from "@/lib/entities/stream";
import { VITE_API_URL } from "@/lib/config";
import { getAuthToken } from "@/lib/utils/auth";
import { isRetryableError, classifyError } from "./streamError";

// Retry configuration - MAX_ATTEMPTS derived from RETRY_DELAYS length
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];
const MAX_ATTEMPTS = RETRY_DELAYS.length;
const NON_TERMINAL_CLOSE_MESSAGE = "Stream closed before terminal event";

// Initial delay before polling in distributed mode
// This gives the worker time to pick up the task and start the stream
const INITIAL_POLL_DELAY_MS = 500;

/**
 * Delays execution for specified milliseconds.
 * Supports optional AbortSignal for early cancellation.
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted)
			return reject(new DOMException("Aborted", "AbortError"));
		const t = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(t);
				reject(new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}

/**
 * Unified interface for stream sources.
 * Both sync and distributed modes implement this interface,
 * allowing consistent handling in the chat hook.
 */
export interface StreamSource {
	onEvent(handler: (event: StreamEvent) => void): void;
	onError(handler: (error: Error) => void): void;
	onClose(handler: () => void): void;
	start(): Promise<void>;
	close(): void;
	getLastEventId(): string | null;
}

/**
 * Sync mode: reads from POST response body directly.
 * Used when DISTRIBUTED_WORKERS=false on backend.
 */
export class SyncStreamSource implements StreamSource {
	private reader: ResponseBodyReader;

	constructor(response: Response) {
		this.reader = new ResponseBodyReader(response);
	}

	onEvent(handler: (event: StreamEvent) => void): void {
		this.reader.onEvent(handler);
	}

	onError(handler: (error: Error) => void): void {
		this.reader.onError(handler);
	}

	onClose(handler: () => void): void {
		this.reader.onClose(handler);
	}

	async start(): Promise<void> {
		await this.reader.start();
	}

	close(): void {
		this.reader.close();
	}

	getLastEventId(): string | null {
		return this.reader.lastEventId;
	}
}

export interface DistributedStreamOptions {
	/**
	 * Whether to skip the initial polling delay.
	 * Set to true for the first turn of a conversation (no existing stream to conflict with).
	 * Default: false (applies delay to avoid race condition with worker startup)
	 */
	skipInitialDelay?: boolean;
	lastEventId?: string | null;
}

/**
 * Distributed mode: polls GET endpoint for results.
 * Used when DISTRIBUTED_WORKERS=true on backend.
 * The worker processes the request asynchronously and publishes
 * results to a Redis stream, which this class reads via SSE.
 *
 * Includes retry logic with exponential backoff for transient errors.
 * Also includes an initial delay before polling to avoid race conditions
 * where the stream returns stale data from a previous turn.
 */
export class DistributedStreamSource implements StreamSource {
	private reader: FetchStreamReader | null = null;
	private abortController: AbortController;
	private eventHandler: ((event: StreamEvent) => void) | null = null;
	private errorHandler: ((error: Error) => void) | null = null;
	private closeHandler: (() => void) | null = null;
	private threadId: string;
	private runId: string;
	private lastEventId: string | null;
	private hasTerminalEvent = false;
	private skipInitialDelay: boolean;

	constructor(
		threadId: string,
		runId: string,
		options: DistributedStreamOptions = {},
	) {
		this.threadId = threadId;
		this.runId = runId;
		this.abortController = new AbortController();
		this.skipInitialDelay = options.skipInitialDelay ?? false;
		this.lastEventId = options.lastEventId ?? null;
	}

	onEvent(handler: (event: StreamEvent) => void): void {
		this.eventHandler = handler;
	}

	onError(handler: (error: Error) => void): void {
		this.errorHandler = handler;
	}

	onClose(handler: () => void): void {
		this.closeHandler = handler;
	}

	async start(): Promise<void> {
		try {
			// Apply initial delay for follow-up messages to avoid race condition
			// where the stream returns stale data from the previous turn
			if (!this.skipInitialDelay && !this.lastEventId) {
				await delay(INITIAL_POLL_DELAY_MS, this.abortController.signal);
			}
			await this.startWithRetry();
		} finally {
			if (!this.abortController.signal.aborted) {
				this.closeHandler?.();
			}
		}
	}

	private async startWithRetry(): Promise<void> {
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			try {
				await this.createAndStartReader();
				return; // Success, exit retry loop
			} catch (error) {
				const isError = error instanceof Error;
				const status = isError ? this.getErrorStatus(error) : undefined;
				// Fix 2: Treat 404 as retryable for the first 3 attempts.
				// After a fresh POST /llm/stream 202, a 404 on the stream endpoint
				// almost certainly means the worker hasn't created the Redis key yet.
				const is404Race = status === 404 && attempt < 3;
				const canRetry =
					isError &&
					(is404Race ||
						this.isRecoverableClose(error) ||
						isRetryableError(error, status)) &&
					attempt < MAX_ATTEMPTS - 1;

				if (canRetry) {
					const delayMs = RETRY_DELAYS[attempt];
					console.warn(
						`Stream error (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying in ${delayMs}ms:`,
						error.message,
					);
					await delay(delayMs, this.abortController.signal);
				} else {
					if (this.errorHandler && isError) {
						const finalError = this.toFinalError(error);
						this.errorHandler(finalError);
					}
					return;
				}
			}
		}
	}

	private async createAndStartReader(): Promise<void> {
		const token = getAuthToken();
		const headers: Record<string, string> = {};
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		const url = new URL(
			`${VITE_API_URL}/threads/${this.threadId}/stream`,
			window.location.origin,
		);
		url.searchParams.set("run_id", this.runId);
		if (this.lastEventId) {
			url.searchParams.set("after", this.lastEventId);
		}

		this.hasTerminalEvent = false;
		this.reader = new FetchStreamReader(url.toString(), {
			headers,
			signal: this.abortController.signal,
		});

		this.reader.onEvent((event) => {
			this.lastEventId = this.reader?.lastEventId ?? this.lastEventId;
			if (
				event.type === "done" ||
				event.type === "error" ||
				event.type === "mcp_sandbox_unreachable" ||
				event.type === "aborted"
			) {
				// `mcp_sandbox_unreachable` ends the run. The distributed emitter
				// happens to xadd a trailing `done`, but the sync emitter does not,
				// so without listing it here the reader would treat the close as
				// non-terminal, retry, and finally fall into the non-recovery
				// onError branch (blocking alert + clearMessages).
				this.hasTerminalEvent = true;
			}
			this.eventHandler?.(event);
		});

		await this.reader.start();

		if (this.reader.lastError) {
			throw this.reader.lastError;
		}

		if (!this.abortController.signal.aborted && !this.hasTerminalEvent) {
			throw new Error(NON_TERMINAL_CLOSE_MESSAGE);
		}
	}

	close(): void {
		this.abortController.abort();
		this.reader?.close();
	}

	getLastEventId(): string | null {
		return this.lastEventId;
	}

	getThreadId(): string {
		return this.threadId;
	}

	getRunId(): string {
		return this.runId;
	}

	private getErrorStatus(error: Error): number | undefined {
		const status = (error as Error & { status?: number }).status;
		return typeof status === "number" ? status : undefined;
	}

	private isRecoverableClose(error: Error): boolean {
		return error.message === NON_TERMINAL_CLOSE_MESSAGE;
	}

	private toFinalError(error: Error): Error {
		const status = this.getErrorStatus(error);
		if (this.isRecoverableClose(error)) {
			return new Error(
				"Lost connection to the live stream. Refresh to retry reconnecting.",
			);
		}

		const classified = classifyError(error, status);
		const finalError = new Error(classified.message) as Error & {
			status?: number;
			cause?: Error;
		};
		finalError.status = status;
		finalError.cause = error;
		return finalError;
	}
}
