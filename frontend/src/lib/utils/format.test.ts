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
							id: "call_1",
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
			expect(result[0].type).toBe("tool_input");
			expect(result[0].role).toBe("tool_input");
			expect(result[0].tool_call_id).toBe("call_1");
			expect(result[0].name).toBe("search");
			expect(result[0].input).toEqual({
				query: "test query",
				limit: 10,
			});
			expect(result[0].parent_message_id).toBe("msg-1");
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
							id: "call_2",
							name: "file_write",
							args: '{"file_path": "/test.txt", "content": "Hello World"}',
						},
					],
				},
			];

			const result = formatMessages(checkpointMessages);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("tool_input");
			expect(result[0].role).toBe("tool_input");
			expect(result[0].tool_call_id).toBe("call_2");
			expect(result[0].name).toBe("file_write");
			expect(result[0].input).toEqual({
				file_path: "/test.txt",
				content: "Hello World",
			});
			expect(result[0].parent_message_id).toBe("msg-2");
		});

		it("should handle multiple tool calls with mixed formats", () => {
			const messages = [
				{
					id: "msg-3",
					type: "ai",
					content: "",
					tool_calls: [
						{
							id: "call_3a",
							name: "search",
							args: { query: "test" }, // Object
						},
						{
							id: "call_3b",
							name: "file_read",
							args: '{"file_path": "/test.txt"}', // JSON string
						},
					],
				},
			];

			const result = formatMessages(messages);

			// Each tool call produces its own tool_input message
			expect(result).toHaveLength(2);
			expect(result[0].type).toBe("tool_input");
			expect(result[0].tool_call_id).toBe("call_3a");
			expect(result[0].name).toBe("search");
			expect(result[0].input).toEqual({ query: "test" });
			expect(result[1].type).toBe("tool_input");
			expect(result[1].tool_call_id).toBe("call_3b");
			expect(result[1].name).toBe("file_read");
			expect(result[1].input).toEqual({ file_path: "/test.txt" });
		});

		it("should filter out tool calls with null or undefined args", () => {
			const messages = [
				{
					id: "msg-4",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							id: "call_4",
							name: "valid_tool",
							args: { data: "valid" },
						},
						{
							id: "call_4b",
							name: "invalid_tool_null",
							args: null,
						},
						{
							id: "call_4c",
							name: "invalid_tool_undefined",
							args: undefined,
						},
					],
				},
			];

			const result = formatMessages(messages);

			// Only the valid tool call should produce a message
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("tool_input");
			expect(result[0].tool_call_id).toBe("call_4");
			expect(result[0].input).toEqual({ data: "valid" });
		});

		it("should filter out tool calls with empty string args", () => {
			const messages = [
				{
					id: "msg-5",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							id: "call_5",
							name: "valid_tool",
							args: '{"key": "value"}',
						},
						{
							id: "call_5b",
							name: "invalid_tool_empty",
							args: "",
						},
						{
							id: "call_5c",
							name: "invalid_tool_whitespace",
							args: "   ",
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("tool_input");
			expect(result[0].tool_call_id).toBe("call_5");
			expect(result[0].input).toEqual({ key: "value" });
		});

		it("should handle malformed JSON strings gracefully", () => {
			const messages = [
				{
					id: "msg-6",
					type: "assistant",
					content: "",
					tool_calls: [
						{
							id: "call_6",
							name: "broken_json_tool",
							args: '{"incomplete": ',
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("tool_input");
			expect(result[0].tool_call_id).toBe("call_6");
			// Malformed JSON should be wrapped in { raw: ... }
			expect(result[0].input).toEqual({ raw: '{"incomplete": ' });
		});

		it("should convert to regular assistant message when no valid tool calls exist", () => {
			const messages = [
				{
					id: "msg-7",
					type: "assistant",
					content: "This is a text response",
					tool_calls: [
						{
							id: "call_7",
							name: "tool",
							args: null,
						},
					],
				},
			];

			const result = formatMessages(messages);

			// With text content + no valid tool calls: gets an assistant message
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("assistant");
			expect(result[0].content).toBe("This is a text response");
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
							id: "call_grep1",
							name: "Grep",
							args: '{"pattern": "formatMessages", "output_mode": "files_with_matches"}',
						},
					],
				},
			];

			const result = formatMessages(checkpointMessages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("tool_input");
			expect(result[0].input).toBeDefined();
			expect(result[0].input).toEqual({
				pattern: "formatMessages",
				output_mode: "files_with_matches",
			});
			expect(result[0].tool_call_id).toBe("call_grep1");
			expect(result[0].parent_message_id).toBe("run-abc123");
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
							id: "call_read1",
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
			expect(result[0].role).toBe("tool_input");
			expect(result[0].input).toBeDefined();
			expect(result[0].input).toEqual({
				file_path: "/test/file.ts",
			});
			expect(result[0].tool_call_id).toBe("call_read1");
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

			// Now has 4 messages: user, tool_input, tool, assistant
			expect(result).toHaveLength(4);

			// User message
			expect(result[0].role).toBe("user");

			// AI message with tool call → becomes tool_input
			expect(result[1].role).toBe("tool_input");
			expect(result[1].input).toBeDefined();
			expect(result[1].input.pattern).toBe("formatMessages");
			expect(result[1].tool_call_id).toBe("call_123");

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

	describe("agent_name Propagation", () => {
		it("should preserve agent_name on assistant messages", () => {
			const messages = [
				{
					id: "msg-1",
					type: "ai",
					content: "Hello from subagent",
					agent_name: "researcher",
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("assistant");
			expect(result[0].agent_name).toBe("researcher");
		});

		it("should preserve agent_name on tool call messages", () => {
			const messages = [
				{
					id: "msg-2",
					type: "assistant",
					content: "",
					agent_name: "coder",
					tool_calls: [
						{
							name: "file_read",
							args: { file_path: "/test.txt" },
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("tool_input");
			expect(result[0].agent_name).toBe("coder");
		});

		it("should preserve agent_name on tool result messages", () => {
			const messages = [
				{
					id: "msg-3",
					type: "tool",
					name: "file_read",
					content: "file contents",
					agent_name: "coder",
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("tool");
			expect(result[0].agent_name).toBe("coder");
		});

		it("should preserve null agent_name", () => {
			const messages = [
				{
					id: "msg-4",
					type: "ai",
					content: "From parent agent",
					agent_name: null,
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0].agent_name).toBeNull();
		});

		it("should not add agent_name when not present on source message", () => {
			const messages = [
				{
					id: "msg-5",
					type: "ai",
					content: "No agent_name",
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0]).not.toHaveProperty("agent_name");
		});

		it("should preserve agent_name through full checkpoint thread", () => {
			const messages = [
				{ id: "1", type: "human", content: "Do research" },
				{
					id: "2",
					type: "ai",
					content: "",
					agent_name: "researcher",
					tool_calls: [{ name: "web_search", args: { query: "test" } }],
				},
				{
					id: "3",
					type: "tool",
					name: "web_search",
					content: "results",
					agent_name: "researcher",
				},
				{
					id: "4",
					type: "ai",
					content: "Here are the results",
					agent_name: "researcher",
				},
				{
					id: "5",
					type: "ai",
					content: "Summary from parent",
					agent_name: null,
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(5);
			expect(result[0]).not.toHaveProperty("agent_name");
			expect(result[1].agent_name).toBe("researcher");
			expect(result[2].agent_name).toBe("researcher");
			expect(result[3].agent_name).toBe("researcher");
			expect(result[4].agent_name).toBeNull();
		});

		it("should propagate agent_name from AI message tool_calls to tool result messages", () => {
			const messages = [
				{
					id: "ai-1",
					type: "ai",
					content: "",
					agent_name: "python-programmer",
					tool_calls: [
						{
							id: "call_123",
							name: "execute",
							args: { code: "print(1)" },
						},
					],
				},
				{
					id: "tool-1",
					type: "tool",
					content: "1",
					tool_call_id: "call_123",
					name: "execute",
					status: "success",
				},
			];

			const result = formatMessages(messages);
			const toolMsg = result.find((m: any) => m.role === "tool");
			expect(toolMsg.agent_name).toBe("python-programmer");
		});

		it("should not overwrite existing agent_name on tool result messages", () => {
			const messages = [
				{
					id: "ai-1",
					type: "ai",
					content: "",
					agent_name: "researcher",
					tool_calls: [
						{
							id: "call_456",
							name: "search",
							args: { query: "test" },
						},
					],
				},
				{
					id: "tool-1",
					type: "tool",
					content: "results",
					tool_call_id: "call_456",
					name: "search",
					agent_name: "already-set",
				},
			];

			const result = formatMessages(messages);
			const toolMsg = result.find((m: any) => m.role === "tool");
			expect(toolMsg.agent_name).toBe("already-set");
		});

		it("should not propagate agent_name to tool results from parent (no agent_name) messages", () => {
			const messages = [
				{
					id: "ai-1",
					type: "ai",
					content: "",
					tool_calls: [
						{
							id: "call_789",
							name: "search",
							args: { query: "test" },
						},
					],
				},
				{
					id: "tool-1",
					type: "tool",
					content: "results",
					tool_call_id: "call_789",
					name: "search",
				},
			];

			const result = formatMessages(messages);
			const toolMsg = result.find((m: any) => m.role === "tool");
			expect(toolMsg).not.toHaveProperty("agent_name");
		});

		it("should propagate agent_name to multiple tool results from the same AI message", () => {
			const messages = [
				{
					id: "ai-1",
					type: "ai",
					content: "",
					agent_name: "coder",
					tool_calls: [
						{ id: "call_a", name: "read", args: { path: "a.ts" } },
						{ id: "call_b", name: "read", args: { path: "b.ts" } },
					],
				},
				{
					id: "tool-a",
					type: "tool",
					content: "content a",
					tool_call_id: "call_a",
					name: "read",
				},
				{
					id: "tool-b",
					type: "tool",
					content: "content b",
					tool_call_id: "call_b",
					name: "read",
				},
			];

			const result = formatMessages(messages);
			const toolMsgs = result.filter((m: any) => m.role === "tool");
			expect(toolMsgs).toHaveLength(2);
			expect(toolMsgs[0].agent_name).toBe("coder");
			expect(toolMsgs[1].agent_name).toBe("coder");
		});

		it("should extract agent_name from tool_calls args.subagent_type when agent_name is missing", () => {
			// Simulates checkpoint reload where agent_name is lost but
			// subagent_type persists in tool call arguments
			const messages = [
				{
					id: "ai-1",
					type: "ai",
					content: "",
					tool_calls: [
						{
							id: "call_abc",
							name: "task",
							args: {
								subagent_type: "python-programmer",
								description: "Write fibonacci code",
							},
						},
					],
				},
				{
					id: "tool-1",
					type: "tool",
					content: "Done",
					tool_call_id: "call_abc",
					name: "task",
				},
			];

			const result = formatMessages(messages);
			const toolInput = result.find((m: any) => m.role === "tool_input");
			const toolResult = result.find((m: any) => m.role === "tool");
			expect(toolInput.agent_name).toBe("python-programmer");
			expect(toolResult.agent_name).toBe("python-programmer");
		});

		it("should extract agent_name from JSON string args.subagent_type", () => {
			const messages = [
				{
					id: "ai-1",
					type: "ai",
					content: "",
					tool_calls: [
						{
							id: "call_xyz",
							name: "task",
							args: '{"subagent_type":"researcher","description":"Search the web"}',
						},
					],
				},
				{
					id: "tool-1",
					type: "tool",
					content: "Found results",
					tool_call_id: "call_xyz",
					name: "task",
				},
			];

			const result = formatMessages(messages);
			const toolResult = result.find((m: any) => m.role === "tool");
			expect(toolResult.agent_name).toBe("researcher");
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
							id: "call_complex",
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

			expect(result[0].input).toEqual({
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
							id: "call_complex_json",
							name: "complex_tool",
							args: '{"nested":{"deeply":{"value":"test","array":[1,2,3]}},"another":"field"}',
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result[0].input).toEqual({
				nested: {
					deeply: {
						value: "test",
						array: [1, 2, 3],
					},
				},
				another: "field",
			});
		});

		it("should emit assistant message before tool_inputs when AI has text content", () => {
			const messages = [
				{
					id: "msg-mixed",
					type: "ai",
					content: "Let me search for that.",
					tool_calls: [
						{
							id: "call_mixed",
							name: "search",
							args: { query: "test" },
						},
					],
				},
			];

			const result = formatMessages(messages);

			// First: assistant message with text, second: tool_input
			expect(result).toHaveLength(2);
			expect(result[0].role).toBe("assistant");
			expect(result[0].content).toBe("Let me search for that.");
			expect(result[1].role).toBe("tool_input");
			expect(result[1].tool_call_id).toBe("call_mixed");
		});

		it("should generate composite id for tool_input messages", () => {
			const messages = [
				{
					id: "msg-parent-id",
					type: "ai",
					content: "",
					tool_calls: [
						{
							id: "call_abc123",
							name: "search",
							args: { query: "test" },
						},
					],
				},
			];

			const result = formatMessages(messages);

			expect(result[0].id).toBe("msg-parent-id-tc-call_abc123");
		});

		it("should pass through existing tool_input messages unchanged", () => {
			const messages = [
				{
					id: "tc-1",
					type: "tool_input",
					role: "tool_input",
					tool_call_id: "call_existing",
					name: "search",
					input: { query: "test" },
					parent_message_id: "msg-parent",
				},
			];

			const result = formatMessages(messages);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(messages[0]);
		});
	});
});
