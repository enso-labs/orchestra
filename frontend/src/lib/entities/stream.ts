/**
 * Stream type definitions for distributed workers integration.
 * Supports both sync mode (direct SSE from POST) and distributed mode
 * (202 Accepted + polling GET endpoint).
 */

// Response type from POST in distributed mode
export interface DistributedStreamResponse {
	thread_id: string;
	run_id: string;
	distributed: true;
}

/**
 * Type guard for distributed response detection.
 * Used to determine if the POST response indicates distributed mode.
 */
export function isDistributedResponse(
	response: unknown,
): response is DistributedStreamResponse {
	return (
		typeof response === "object" &&
		response !== null &&
		"distributed" in response &&
		(response as DistributedStreamResponse).distributed === true &&
		"thread_id" in response &&
		typeof (response as DistributedStreamResponse).thread_id === "string" &&
		"run_id" in response &&
		typeof (response as DistributedStreamResponse).run_id === "string"
	);
}

// SSE Event types
export type SSEEventType =
	| "metadata"
	| "messages"
	| "values"
	| "error"
	| "aborted";

export interface MetadataEvent {
	type: "metadata";
	data: {
		thread_id: string;
		run_id: string;
		assistant_id: string | null;
		project_id: string | null;
	};
}

export interface MessagesEvent {
	type: "messages";
	data: [message: Record<string, unknown>, metadata: { thread_id: string }];
}

export interface ValuesEvent {
	type: "values";
	data: {
		messages: Array<Record<string, unknown>>;
		files?: Record<string, unknown>;
		todos?: Record<string, unknown>;
	};
}

export interface ErrorEvent {
	type: "error";
	data: { error: string };
}

export interface AbortedEvent {
	type: "aborted";
	data: { reason: string };
}

export type SSEEvent =
	| MetadataEvent
	| MessagesEvent
	| ValuesEvent
	| ErrorEvent
	| AbortedEvent;

export interface DoneSignal {
	type: "done";
}

export type StreamEvent = SSEEvent | DoneSignal;

export type ActiveStreamRecoveryRecord = {
	threadId: string;
	runId: string;
	lastEventId: string | null;
	startedAt: string;
	updatedAt: string;
	route: string;
	status: "running";
};
