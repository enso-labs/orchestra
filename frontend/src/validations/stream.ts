import { z } from "zod";
import type { StreamEvent, SSEEvent } from "@/lib/entities/stream";

/**
 * Zod validation schemas for distributed stream responses and SSE events.
 */

// Schema for distributed mode POST response
export const DistributedResponseSchema = z.object({
	thread_id: z.string().uuid(),
	run_id: z.string().uuid(),
	distributed: z.literal(true),
});

// Schema for metadata event payload
export const MetadataPayloadSchema = z.object({
	thread_id: z.string(),
	run_id: z.string().optional(),
	assistant_id: z.string().nullable(),
	project_id: z.string().nullable(),
});

// Schema for messages event payload - tuple of [message, metadata]
export const MessagesPayloadSchema = z.tuple([
	z.record(z.unknown()), // message object
	z.object({ thread_id: z.string() }), // metadata with thread_id
]);

// Schema for values event payload
export const ValuesPayloadSchema = z.object({
	messages: z.array(z.record(z.unknown())),
	files: z.record(z.unknown()).optional(),
	todos: z.record(z.unknown()).optional(),
});

// Schema for error event payload
export const ErrorPayloadSchema = z.object({
	error: z.string(),
});

// SSE Event schema (array format: ["type", payload])
export const SSEEventSchema = z.union([
	z.tuple([z.literal("metadata"), MetadataPayloadSchema]),
	z.tuple([z.literal("messages"), MessagesPayloadSchema]),
	z.tuple([z.literal("values"), ValuesPayloadSchema]),
	z.tuple([z.literal("error"), ErrorPayloadSchema]),
]);

/**
 * Parses a raw SSE data string into a StreamEvent.
 * Handles both JSON array format and [DONE] signal.
 *
 * @param data - Raw SSE data string (without "data: " prefix)
 * @returns Parsed StreamEvent or null if parsing fails
 */
export function parseStreamEvent(data: string): StreamEvent | null {
	// Handle [DONE] signal
	if (data === "[DONE]") {
		return { type: "done" };
	}

	try {
		const parsed = JSON.parse(data);

		// Validate against SSE event schema
		const result = SSEEventSchema.safeParse(parsed);

		if (!result.success) {
			console.warn("SSE event validation failed:", result.error);
			return null;
		}

		const [type, payload] = result.data;

		// Transform to typed event object
		switch (type) {
			case "metadata":
				return { type: "metadata", data: payload };
			case "messages":
				return {
					type: "messages",
					data: payload as SSEEvent extends { type: "messages"; data: infer D }
						? D
						: never,
				};
			case "values":
				return { type: "values", data: payload };
			case "error":
				return { type: "error", data: payload };
			default:
				return null;
		}
	} catch {
		// Malformed JSON - skip
		return null;
	}
}
