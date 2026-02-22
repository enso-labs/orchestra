import { describe, it, expect, beforeEach } from "vitest";
import { StreamMessageHandler } from "./message";

/**
 * Helper to create mock refs that mimic React.MutableRefObject
 */
function createMockRefs() {
	const toolNameRef = { current: "" };
	const toolCallMapRef = { current: new Map() };
	return { toolNameRef, toolCallMapRef };
}

describe("StreamMessageHandler.toolCall", () => {
	let refs: ReturnType<typeof createMockRefs>;
	let history: any[];
	let handler: StreamMessageHandler;

	beforeEach(() => {
		refs = createMockRefs();
		history = [];
		handler = new StreamMessageHandler(
			refs.toolNameRef as any,
			refs.toolCallMapRef as any,
			history,
		);
	});

	it("should accumulate args across multi-chunk single tool call", () => {
		// Chunk 1: id present, name present, args empty (matches real SSE data)
		handler.toolCall({
			id: "run--686299fe-5a47-499c-86e5-b37d8aad0acc",
			tool_call_chunks: [
				{
					name: "get_weather",
					args: "",
					id: "call_37nosGTDYyZFK4rnBHvVDnKg",
					index: 0,
				},
			],
		});

		// Chunk 2: id null, args fragment
		handler.toolCall({
			id: "run--686299fe-5a47-499c-86e5-b37d8aad0acc",
			tool_call_chunks: [{ name: null, args: '{"', id: null, index: 0 }],
		});

		// Chunk 3: id null, args fragment
		handler.toolCall({
			id: "run--686299fe-5a47-499c-86e5-b37d8aad0acc",
			tool_call_chunks: [{ name: null, args: "city", id: null, index: 0 }],
		});

		// Chunk 4: id null, args fragment
		handler.toolCall({
			id: "run--686299fe-5a47-499c-86e5-b37d8aad0acc",
			tool_call_chunks: [{ name: null, args: '":"', id: null, index: 0 }],
		});

		// Chunk 5: id null, args fragment
		handler.toolCall({
			id: "run--686299fe-5a47-499c-86e5-b37d8aad0acc",
			tool_call_chunks: [{ name: null, args: "Dallas", id: null, index: 0 }],
		});

		// Chunk 6: id null, args closing
		handler.toolCall({
			id: "run--686299fe-5a47-499c-86e5-b37d8aad0acc",
			tool_call_chunks: [{ name: null, args: '"}', id: null, index: 0 }],
		});

		// Should have exactly 1 tool_input entry
		expect(history).toHaveLength(1);
		expect(history[0].type).toBe("tool_input");
		expect(history[0].name).toBe("get_weather");
		expect(history[0].tool_call_id).toBe("call_37nosGTDYyZFK4rnBHvVDnKg");
		// Final args should be parsed JSON
		expect(history[0].input).toEqual({ city: "Dallas" });
	});

	it("should handle multi-tool calls with interleaved chunks", () => {
		const responseId = "run--multi-tool";

		// Tool 0, chunk 1: id present
		handler.toolCall({
			id: responseId,
			tool_call_chunks: [
				{
					name: "get_weather",
					args: "",
					id: "call_weather_1",
					index: 0,
				},
			],
		});

		// Tool 1, chunk 1: id present
		handler.toolCall({
			id: responseId,
			tool_call_chunks: [
				{
					name: "search_web",
					args: "",
					id: "call_search_1",
					index: 1,
				},
			],
		});

		// Tool 0, chunk 2: args fragment, id null
		handler.toolCall({
			id: responseId,
			tool_call_chunks: [
				{ name: null, args: '{"city":"Dallas"}', id: null, index: 0 },
			],
		});

		// Tool 1, chunk 2: args fragment, id null
		handler.toolCall({
			id: responseId,
			tool_call_chunks: [
				{ name: null, args: '{"query":"news"}', id: null, index: 1 },
			],
		});

		// Should have 2 entries, one per tool call
		expect(history).toHaveLength(2);

		const weatherEntry = history.find(
			(h: any) => h.tool_call_id === "call_weather_1",
		);
		const searchEntry = history.find(
			(h: any) => h.tool_call_id === "call_search_1",
		);

		expect(weatherEntry).toBeDefined();
		expect(weatherEntry.name).toBe("get_weather");
		expect(weatherEntry.input).toEqual({ city: "Dallas" });

		expect(searchEntry).toBeDefined();
		expect(searchEntry.name).toBe("search_web");
		expect(searchEntry.input).toEqual({ query: "news" });
	});

	it("should handle single chunk with complete args and id", () => {
		handler.toolCall({
			id: "run--single-chunk",
			tool_call_chunks: [
				{
					name: "get_weather",
					args: '{"city":"Dallas"}',
					id: "call_complete",
					index: 0,
				},
			],
		});

		expect(history).toHaveLength(1);
		expect(history[0].type).toBe("tool_input");
		expect(history[0].tool_call_id).toBe("call_complete");
		expect(history[0].name).toBe("get_weather");
		expect(history[0].input).toEqual({ city: "Dallas" });
	});

	it("should show partial args as string during streaming before JSON is complete", () => {
		const responseId = "run--partial";

		// Chunk 1: id present, args empty
		handler.toolCall({
			id: responseId,
			tool_call_chunks: [
				{ name: "get_weather", args: "", id: "call_partial", index: 0 },
			],
		});

		// Chunk 2: partial JSON
		handler.toolCall({
			id: responseId,
			tool_call_chunks: [{ name: null, args: '{"city":', id: null, index: 0 }],
		});

		// At this point args is incomplete JSON, should be stored as string
		expect(history).toHaveLength(1);
		expect(history[0].input).toBe('{"city":');

		// Chunk 3: complete the JSON
		handler.toolCall({
			id: responseId,
			tool_call_chunks: [{ name: null, args: '"Dallas"}', id: null, index: 0 }],
		});

		// Now should be parsed as object
		expect(history[0].input).toEqual({ city: "Dallas" });
	});

	it("should propagate agent_name from response to history entry", () => {
		handler.toolCall({
			id: "run--agent",
			agent_name: "researcher",
			tool_call_chunks: [
				{
					name: "search",
					args: '{"q":"test"}',
					id: "call_agent",
					index: 0,
				},
			],
		});

		expect(history[0].agent_name).toBe("researcher");
	});

	it("should update toolNameRef with the tool name", () => {
		handler.toolCall({
			id: "run--ref",
			tool_call_chunks: [
				{
					name: "my_tool",
					args: "",
					id: "call_ref",
					index: 0,
				},
			],
		});

		expect(refs.toolNameRef.current).toBe("my_tool");
	});
});
