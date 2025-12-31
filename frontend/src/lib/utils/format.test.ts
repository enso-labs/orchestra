import { describe, it, expect } from "vitest";
import { formatMessages } from "./format";

describe("formatMessages", () => {
	describe("Tool Call Normalization", () => {
		it("should handle streaming data with object args", () => {
			// Simulate streaming data where tool_calls[0].args is an object
			const streamingMessages = [
				{
					id: "msg-1",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							name: "search",
							args: {
								query: "test query",
								limit: 10,
							},
						},
					],
				},
			];

			const result = formatMessages(streamingMessages);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("AIMessageChunk");
			expect(result[0].role).toBe("AIMessageChunk");
			expect(result[0].input).toEqual([
				{
					query: "test query",
					limit: 10,
				},
			]);
		});

		it("should handle checkpoint data with JSON string args", () => {
			// Simulate checkpoint data where tool_calls[0].args is a JSON string
			const checkpointMessages = [
				{
					id: "msg-2",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							name: "file_write",
							args: '{"file_path": "/test.txt", "content": "Hello World"}',
						},
					],
				},
			];

			const result = formatMessages(checkpointMessages);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("AIMessageChunk");
			expect(result[0].role).toBe("AIMessageChunk");
			expect(result[0].input).toEqual([
				{
					file_path: "/test.txt",
					content: "Hello World",
				},
			]);
		});

		it("should handle multiple tool calls with mixed formats", () => {
			const messages = [
				{
					id: "msg-3",
					type: "ai",
					content: "",
					tool_calls: [
						{
							name: "search",
							args: { query: "test" }, // Object
						},
						{
							name: "file_read",
							args: '{"file_path": "/test.txt"}', // JSON string
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("AIMessageChunk");
			expect(result[0].role).toBe("AIMessageChunk");
			expect(result[0].input).toHaveLength(2);
			expect(result[0].input[0]).toEqual({ query: "test" });
			expect(result[0].input[1]).toEqual({ file_path: "/test.txt" });
		});

		it("should filter out tool calls with null or undefined args", () => {
			const messages = [
				{
					id: "msg-4",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							name: "valid_tool",
							args: { data: "valid" },
						},
						{
							name: "invalid_tool_null",
							args: null,
						},
						{
							name: "invalid_tool_undefined",
							args: undefined,
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("AIMessageChunk");
			expect(result[0].input).toHaveLength(1);
			expect(result[0].input[0]).toEqual({ data: "valid" });
		});

		it("should filter out tool calls with empty string args", () => {
			const messages = [
				{
					id: "msg-5",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							name: "valid_tool",
							args: '{"key": "value"}',
						},
						{
							name: "invalid_tool_empty",
							args: "",
						},
						{
							name: "invalid_tool_whitespace",
							args: "   ",
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("AIMessageChunk");
			expect(result[0].input).toHaveLength(1);
			expect(result[0].input[0]).toEqual({ key: "value" });
		});

		it("should handle malformed JSON strings gracefully", () => {
			const messages = [
				{
					id: "msg-6",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							name: "broken_json_tool",
							args: '{"incomplete": ',
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("AIMessageChunk");
			expect(result[0].input).toHaveLength(1);
			// Malformed JSON should be wrapped in { raw: ... }
			expect(result[0].input[0]).toEqual({ raw: '{"incomplete": ' });
		});

		it("should convert to regular assistant message when no valid tool calls exist", () => {
			const messages = [
				{
					id: "msg-7",
					type: "assistant",
					content: "This is a text response",
					tool_calls: [
						{
							name: "tool",
							args: null,
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("assistant");
			expect(result[0].input).toBeUndefined();
		});

		it("should handle messages without tool_calls", () => {
			const messages = [
				{
					id: "msg-8",
					type: "human",
					content: "Hello",
				},
				{
					id: "msg-9",
					type: "assistant",
					content: "Hi there!",
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(2);
			expect(result[0].role).toBe("user");
			expect(result[1].role).toBe("assistant");
		});
	});

	describe("Regression Tests for 'Invalid message' Bug", () => {
		it("should NOT produce 'Invalid message' for checkpoint tool calls", () => {
			// This is the exact scenario that caused the bug:
			// Checkpoint data from backend with JSON string args
			const checkpointMessages = [
				{
					id: "run-abc123",
					type: "ai",
					content: "",
					tool_calls: [
						{
							name: "Grep",
							args: '{"pattern": "formatMessages", "output_mode": "files_with_matches"}',
						},
					],
				},
			];

			const result = formatMessages(checkpointMessages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("AIMessageChunk");
			expect(result[0].input).toBeDefined();
			expect(result[0].input).toHaveLength(1);
			expect(result[0].input[0]).toEqual({
				pattern: "formatMessages",
				output_mode: "files_with_matches",
			});

			// The message should have either content or input
			const hasValidContent = result[0].content || result[0].input;
			expect(hasValidContent).toBeTruthy();
		});

		it("should NOT produce 'Invalid message' for streaming tool calls", () => {
			// This is the working scenario:
			// Streaming data with object args
			const streamingMessages = [
				{
					id: "run-xyz789",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							name: "Read",
							args: {
								file_path: "/test/file.ts",
							},
						},
					],
				},
			];

			const result = formatMessages(streamingMessages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("AIMessageChunk");
			expect(result[0].input).toBeDefined();
			expect(result[0].input).toHaveLength(1);
			expect(result[0].input[0]).toEqual({
				file_path: "/test/file.ts",
			});

			// The message should have either content or input
			const hasValidContent = result[0].content || result[0].input;
			expect(hasValidContent).toBeTruthy();
		});

		it("should handle real checkpoint data structure from backend", () => {
			// Simulate actual checkpoint structure from useThread.ts loadThread()
			const backendCheckpoint = {
				values: {
					messages: [
						{
							id: "msg-user-1",
							type: "human",
							content: "Search for formatMessages",
						},
						{
							id: "msg-ai-1",
							type: "ai",
							content: "",
							tool_calls: [
								{
									name: "Grep",
									id: "call_123",
									args: '{"pattern":"formatMessages","output_mode":"files_with_matches"}',
								},
							],
						},
						{
							id: "msg-tool-1",
							type: "tool",
							name: "Grep",
							content: "file1.ts\nfile2.ts",
						},
						{
							id: "msg-ai-2",
							type: "ai",
							content: "Found formatMessages in file1.ts and file2.ts",
							tool_calls: [],
						},
					],
				},
			};

			const result = formatMessages(backendCheckpoint.values.messages);

			expect(result).toHaveLength(4);

			// User message
			expect(result[0].role).toBe("user");

			// AI message with tool call
			expect(result[1].role).toBe("AIMessageChunk");
			expect(result[1].input).toBeDefined();
			expect(result[1].input[0].pattern).toBe("formatMessages");

			// Tool result
			expect(result[2].role).toBe("tool");

			// AI response
			expect(result[3].role).toBe("assistant");

			// Verify NO message would trigger "Invalid message"
			result.forEach((msg) => {
				const hasValidContent = msg.content || msg.input;
				expect(hasValidContent).toBeTruthy();
			});
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty messages array", () => {
			const result = formatMessages([]);
			expect(result).toEqual([]);
		});

		it("should handle null/undefined messages", () => {
			const result1 = formatMessages(null as any);
			const result2 = formatMessages(undefined as any);
			expect(result1).toEqual([]);
			expect(result2).toEqual([]);
		});

		it("should preserve message order", () => {
			const messages = [
				{ id: "1", type: "human", content: "First" },
				{ id: "2", type: "ai", content: "Second" },
				{ id: "3", type: "human", content: "Third" },
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(3);
			expect(result[0].content).toBe("First");
			expect(result[1].content).toBe("Second");
			expect(result[2].content).toBe("Third");
		});

		it("should handle complex nested tool arguments", () => {
			const messages = [
				{
					id: "msg-complex",
					type: "assistant",
					tool_calls: [
						{
							name: "complex_tool",
							args: {
								nested: {
									deeply: {
										value: "test",
										array: [1, 2, 3],
									},
								},
								another: "field",
							},
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result[0].input[0]).toEqual({
				nested: {
					deeply: {
						value: "test",
						array: [1, 2, 3],
					},
				},
				another: "field",
			});
		});

		it("should handle complex nested JSON string arguments", () => {
			const messages = [
				{
					id: "msg-complex-json",
					type: "ai",
					tool_calls: [
						{
							name: "complex_tool",
							args: '{"nested":{"deeply":{"value":"test","array":[1,2,3]}},"another":"field"}',
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result[0].input[0]).toEqual({
				nested: {
					deeply: {
						value: "test",
						array: [1, 2, 3],
					},
				},
				another: "field",
			});
		});
	});
});
