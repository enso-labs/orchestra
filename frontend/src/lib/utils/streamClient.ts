import { SSE } from "sse.js";

export default class StreamClient {
	private sse: SSE;
	private source: any;

	constructor(url: string) {
		this.sse = new SSE(url);
	}

	public send(
		payload: any,
		headers?: Record<string, string>,
		method: string = "POST",
	) {
		const source = this.sse;
		source.method = method;
		if (headers) {
			source.headers = headers;
		}
		source.payload = JSON.stringify(payload);
		this.source = source;
		return source;
	}

	public onMessage(callback: (event: MessageEvent) => void) {
		this.source.addEventListener("message", callback);
	}

	public onError(callback: (event: MessageEvent) => void) {
		this.source.addEventListener("error", callback);
	}

	public onOpen(callback: (event: MessageEvent) => void) {
		this.source.addEventListener("open", callback);
	}

	public onClose(callback: (event: MessageEvent) => void) {
		this.source.addEventListener("close", callback);
	}

	public onRetry(callback: (event: MessageEvent) => void) {
		this.source.addEventListener("retry", callback);
	}

	public onReconnect(callback: (event: MessageEvent) => void) {
		this.source.addEventListener("reconnect", callback);
	}

	public onReconnectAttempt(callback: (event: MessageEvent) => void) {
		this.source.addEventListener("reconnectAttempt", callback);
	}

	public stream() {
		this.source.stream();
	}

	public close() {
		this.source.close();
	}
}
