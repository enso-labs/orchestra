import { SSE, SSEOptions } from "sse.js";
import { Agent } from "../services/agentService";
import { VITE_API_URL } from "../config";

type MessageContent = string | Array<{ type: string; [key: string]: any }>;
type Messages = { role: string; content: MessageContent; [key: string]: any }[];
type Input = { messages: Messages };
// type Metadata = { thread_id?: string; checkpoint_id?: string; [key: string]: any };
type A2A = { [key: string]: any };
type MCP = { [key: string]: any };
type Tools = string[];
type Subagents = Agent[];
type Presidio = {
	analyze?: boolean;
	anonymize?: boolean;
	redact?: boolean;
};
interface StreamThreadPayload {
	system?: string;
	input: Input;
	model: string;
	metadata: any;
	a2a?: A2A;
	mcp?: MCP;
	tools?: Tools;
	subagents?: Subagents;
	presidio?: Presidio;
}

export class SourceStream {
	public source: SSE;
	public controller: AbortController;

	constructor() {
		this.source = new SSE(`${VITE_API_URL}/llm/stream`);
		this.controller = new AbortController();
	}

	public createSource(payload: StreamThreadPayload) {
		try {
			const newConfig: SSEOptions = {
				start: false,
				method: "POST",
				payload: JSON.stringify(payload),
				headers: {
					"Content-Type": "application/json",
					Accept: "text/event-stream",
				},
			};
			this.source = new SSE(`${VITE_API_URL}/llm/stream`, newConfig);
			return this.source;
		} catch (error: unknown) {
			console.error("Error streaming thread:", error);
			throw error;
		}
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

	public onAbort(callback: (event: MessageEvent) => void) {
		if (this.controller) {
			this.controller.signal.addEventListener("abort", (event: Event) => {
				callback(event as MessageEvent);
			});
		}
	}
}