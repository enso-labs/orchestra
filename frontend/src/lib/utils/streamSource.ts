import { FetchStreamReader, ResponseBodyReader } from "./fetchStreamReader";
import type { StreamEvent } from "@/lib/entities/stream";
import { VITE_API_URL } from "@/lib/config";
import { getAuthToken } from "@/lib/utils/auth";
import { isRetryableError, classifyError } from "./streamError";

// Retry configuration - MAX_ATTEMPTS derived from RETRY_DELAYS length
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms
const MAX_ATTEMPTS = RETRY_DELAYS.length;

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
}

export interface DistributedStreamOptions {
	/**
	 * Whether to skip the initial polling delay.
	 * Set to true for the first turn of a conversation (no existing stream to conflict with).
	 * Default: false (applies delay to avoid race condition with worker startup)
	 */
	skipInitialDelay?: boolean;
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
	private skipInitialDelay: boolean;

	constructor(threadId: string, options: DistributedStreamOptions = {}) {
		this.threadId = threadId;
		this.abortController = new AbortController();
		this.skipInitialDelay = options.skipInitialDelay ?? false;
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
		// Apply initial delay for follow-up messages to avoid race condition
		// where the stream returns stale data from the previous turn
		if (!this.skipInitialDelay) {
			await delay(INITIAL_POLL_DELAY_MS, this.abortController.signal);
		}
		await this.startWithRetry();
	}

	private async startWithRetry(): Promise<void> {
		const maxAttempts = MAX_ATTEMPTS;
		let attempt = 0;

		while (attempt < maxAttempts) {
			try {
				await this.createAndStartReader();
				return; // Success, exit retry loop
			} catch (error) {
				const isError = error instanceof Error;
				const canRetry =
					isError && isRetryableError(error) && attempt < maxAttempts - 1;

				if (canRetry) {
					const delayMs = RETRY_DELAYS[attempt];
					console.warn(
						`Stream error (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delayMs}ms:`,
						error.message,
					);
					await delay(delayMs, this.abortController.signal);
					attempt++;
				} else {
					// Non-retryable or max retries exceeded
					if (this.errorHandler && isError) {
						const classified = classifyError(error);
						this.errorHandler(new Error(classified.message));
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

		this.reader = new FetchStreamReader(
			`${VITE_API_URL}/threads/${this.threadId}/stream`,
			{
				headers,
				signal: this.abortController.signal,
			},
		);

		// Wire up handlers
		if (this.eventHandler) {
			this.reader.onEvent(this.eventHandler);
		}
		if (this.closeHandler) {
			this.reader.onClose(this.closeHandler);
		}
		if (this.errorHandler) {
			// Wire error handler so start() can dispatch errors before re-throwing.
			// startWithRetry catches the re-thrown error for retry logic, but does
			// not dispatch again (avoiding double-reporting).
			this.reader.onError(this.errorHandler);
		}

		await this.reader.start();
	}

	close(): void {
		this.abortController.abort();
		this.reader?.close();
	}
}
