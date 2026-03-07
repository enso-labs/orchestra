import type { StreamEvent, SSEEvent } from "@/lib/entities/stream";

export interface FetchStreamReaderOptions {
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

/**
 * Custom SSE reader using fetch API with support for Authorization headers.
 * Unlike EventSource, this allows custom headers for authenticated endpoints.
 */
export class FetchStreamReader {
	private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	private decoder = new TextDecoder();
	private buffer = "";
	private eventHandler: ((event: StreamEvent) => void) | null = null;
	private errorHandler: ((error: Error) => void) | null = null;
	private closeHandler: (() => void) | null = null;
	private aborted = false;
	private _lastError: Error | null = null;

	constructor(
		private url: string,
		private options: FetchStreamReaderOptions = {},
	) {}

	/**
	 * Returns the last error that occurred during streaming, if any.
	 * Used by DistributedStreamSource for retry logic.
	 */
	get lastError(): Error | null {
		return this._lastError;
	}

	onEvent(handler: (event: StreamEvent) => void): this {
		this.eventHandler = handler;
		return this;
	}

	onError(handler: (error: Error) => void): this {
		this.errorHandler = handler;
		return this;
	}

	onClose(handler: () => void): this {
		this.closeHandler = handler;
		return this;
	}

	async start(): Promise<void> {
		try {
			const response = await fetch(this.url, {
				method: "GET",
				headers: {
					Accept: "text/event-stream",
					...this.options.headers,
				},
				signal: this.options.signal,
			});

			if (!response.ok) {
				throw new Error(`Stream failed: ${response.status}`);
			}

			this.reader = response.body?.getReader() ?? null;
			if (!this.reader) {
				throw new Error("No response body");
			}

			await this.readLoop();
		} catch (error) {
			if (error instanceof Error && error.name !== "AbortError") {
				this._lastError = error;
				this.errorHandler?.(error);
			}
		} finally {
			if (!this.aborted) {
				this.closeHandler?.();
			}
		}
	}

	close(): void {
		this.aborted = true;
		this.reader?.cancel();
		this.reader = null;
	}

	private async readLoop(): Promise<void> {
		if (!this.reader) return;

		while (true) {
			const { done, value } = await this.reader.read();
			if (done) break;

			this.buffer += this.decoder.decode(value, { stream: true });
			this.processBuffer();
		}
	}

	private processBuffer(): void {
		const lines = this.buffer.split("\n");
		this.buffer = lines.pop() ?? "";

		for (const line of lines) {
			// Skip keep-alive comments (lines starting with :)
			if (line.startsWith(":")) continue;
			// Skip empty lines
			if (!line.trim()) continue;

			if (line.startsWith("data: ")) {
				const data = line.slice(6); // Remove 'data: ' prefix

				if (data === "[DONE]") {
					this.eventHandler?.({ type: "done" });
					continue;
				}

				try {
					const parsed = JSON.parse(data);
					const event = this.parseEvent(parsed);
					if (event) {
						this.eventHandler?.(event);
					}
				} catch {
					// Skip malformed JSON
				}
			}
		}
	}

	private parseEvent(parsed: unknown): SSEEvent | null {
		if (!Array.isArray(parsed) || parsed.length !== 2) return null;

		const [type, payload] = parsed;

		switch (type) {
			case "metadata":
				return { type: "metadata", data: payload };
			case "messages":
				return { type: "messages", data: payload };
			case "values":
				return { type: "values", data: payload };
			case "error":
				return {
					type: "error",
					data:
						typeof payload === "object" &&
						payload !== null &&
						"error" in payload
							? payload
							: {
									error:
										typeof payload === "string" ? payload : String(payload),
								},
				};
			default:
				return null;
		}
	}
}

/**
 * Reads SSE events from an existing Response body.
 * Used for sync mode where POST response directly contains the stream.
 */
export class ResponseBodyReader {
	private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	private decoder = new TextDecoder();
	private buffer = "";
	private eventHandler: ((event: StreamEvent) => void) | null = null;
	private errorHandler: ((error: Error) => void) | null = null;
	private closeHandler: (() => void) | null = null;
	private aborted = false;

	constructor(private response: Response) {}

	onEvent(handler: (event: StreamEvent) => void): this {
		this.eventHandler = handler;
		return this;
	}

	onError(handler: (error: Error) => void): this {
		this.errorHandler = handler;
		return this;
	}

	onClose(handler: () => void): this {
		this.closeHandler = handler;
		return this;
	}

	async start(): Promise<void> {
		try {
			this.reader = this.response.body?.getReader() ?? null;
			if (!this.reader) {
				throw new Error("No response body");
			}

			await this.readLoop();
		} catch (error) {
			if (error instanceof Error && error.name !== "AbortError") {
				this.errorHandler?.(error);
			}
		} finally {
			if (!this.aborted) {
				this.closeHandler?.();
			}
		}
	}

	close(): void {
		this.aborted = true;
		this.reader?.cancel();
		this.reader = null;
	}

	private async readLoop(): Promise<void> {
		if (!this.reader) return;

		while (true) {
			const { done, value } = await this.reader.read();
			if (done) break;

			this.buffer += this.decoder.decode(value, { stream: true });
			this.processBuffer();
		}
	}

	private processBuffer(): void {
		const lines = this.buffer.split("\n");
		this.buffer = lines.pop() ?? "";

		for (const line of lines) {
			// Skip keep-alive comments
			if (line.startsWith(":")) continue;
			// Skip empty lines
			if (!line.trim()) continue;

			if (line.startsWith("data: ")) {
				const data = line.slice(6);

				if (data === "[DONE]") {
					this.eventHandler?.({ type: "done" });
					continue;
				}

				try {
					const parsed = JSON.parse(data);
					const event = this.parseEvent(parsed);
					if (event) {
						this.eventHandler?.(event);
					}
				} catch {
					// Skip malformed JSON
				}
			}
		}
	}

	private parseEvent(parsed: unknown): SSEEvent | null {
		if (!Array.isArray(parsed) || parsed.length !== 2) return null;

		const [type, payload] = parsed;

		switch (type) {
			case "metadata":
				return { type: "metadata", data: payload };
			case "messages":
				return { type: "messages", data: payload };
			case "values":
				return { type: "values", data: payload };
			case "error":
				return {
					type: "error",
					data:
						typeof payload === "object" &&
						payload !== null &&
						"error" in payload
							? payload
							: {
									error:
										typeof payload === "string" ? payload : String(payload),
								},
				};
			default:
				return null;
		}
	}
}
