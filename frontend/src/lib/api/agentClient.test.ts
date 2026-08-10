import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AGENT_STREAM_MODES,
	PRODUCTION_ASSISTANT_ID,
	agentClient,
	adaptEvent,
	describeAgentError,
	getAgentApiUrl,
	mapAssistantToProductionGraph,
} from "./agentClient";

const getAuthToken = vi.fn<() => string | null>();
vi.mock("@/lib/utils/auth", () => ({
	getAuthToken: () => getAuthToken(),
}));

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("agentClient", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		getAuthToken.mockReturnValue("token-one");
	});

	it("uses the browser origin rather than the custom /api base", () => {
		expect(getAgentApiUrl()).toBe(window.location.origin);
		expect(getAgentApiUrl()).not.toContain("/api");
	});

	it("attaches the current token on every SDK request and rotates it", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => jsonResponse({ thread_id: "thread-1" }));

		await agentClient.threads.get("thread-1");
		getAuthToken.mockReturnValue("token-two");
		await agentClient.threads.get("thread-2");

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(
			new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization"),
		).toBe("Bearer token-one");
		expect(
			new Headers(fetchMock.mock.calls[1][1]?.headers).get("authorization"),
		).toBe("Bearer token-two");
	});

	it("does not send an Authorization header after logout", async () => {
		getAuthToken.mockReturnValue(null);
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(jsonResponse({ thread_id: "thread-1" }));

		await agentClient.threads.get("thread-1");

		const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
		expect(headers.has("authorization")).toBe(false);
	});

	it("preserves non-JSON HTTP failures as rejected SDK requests", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("upstream unavailable", {
				status: 400,
				statusText: "Bad Request",
			}),
		);

		await expect(agentClient.threads.get("thread-1")).rejects.toThrow("400");
	});
});

describe("assistant mapping and stream contract", () => {
	it("uses one production assistant while carrying canonical settings in context", () => {
		const mapping = mapAssistantToProductionGraph(
			{
				id: "assistant-7",
				model: "openai:gpt-4.1-mini",
				prompt: "Be concise",
				tools: ["search"],
			},
			{
				thread_id: "thread-7",
				project_id: "project-2",
				user_id: "must-not-cross",
			},
		);

		expect(mapping.assistantId).toBe(PRODUCTION_ASSISTANT_ID);
		expect(mapping.graphId).toBe("orchestra");
		expect(mapping.context).toMatchObject({
			assistant_id: "assistant-7",
			model: "openai:gpt-4.1-mini",
			tools: ["search"],
			project_id: "project-2",
		});
		expect(mapping.config.configurable.user_id).toBeUndefined();
		expect(mapping.metadata).toMatchObject({
			thread_id: "thread-7",
			orchestra_assistant_id: "assistant-7",
		});
	});

	it("keeps only valid primitive values in protocol metadata", () => {
		const mapping = mapAssistantToProductionGraph(
			{ id: undefined, model: "openai:gpt-4.1-mini" },
			{
				orchestra_assistant_id: null,
				project_id: null,
				tools: [],
				mcp: {},
				system_prompt: "x".repeat(513),
				feature_flag: true,
				attempt: 2,
			},
		);

		expect(mapping.metadata).toEqual({
			feature_flag: true,
			attempt: 2,
			graph_id: "orchestra",
		});
	});

	it("adapts messages tuples, values, custom, subgraphs, and terminal errors", () => {
		expect(AGENT_STREAM_MODES).toEqual(["messages-tuple", "values", "custom"]);

		const message = adaptEvent({
			event: "messages|researcher",
			id: "cursor-1",
			data: [
				{ id: "message-1", type: "AIMessageChunk", content: "hello" },
				{ lc_agent_name: "researcher", tags: [] },
			],
		});
		expect(message).toMatchObject({
			type: "messages",
			id: "cursor-1",
			subgraph: "researcher",
			data: [
				{
					id: "message-1",
					type: "ai",
					content: "hello",
					agent_name: "researcher",
				},
				expect.anything(),
			],
		});
		expect(adaptEvent({ event: "values", data: { todos: [] } })).toMatchObject({
			type: "values",
		});
		expect(
			adaptEvent({ event: "custom", data: { type: "files" } }),
		).toMatchObject({
			type: "custom",
		});
		expect(
			adaptEvent({
				event: "error",
				data: { error: "boom", message: "failed" },
			}),
		).toMatchObject({
			type: "error",
			data: { error: "boom", message: "failed" },
		});
		expect(adaptEvent({ event: "future-mode", data: {} })).toBeNull();
	});

	it("describes HTTP and cancellation states without browser alerts", () => {
		expect(describeAgentError({ status: 401 }).message).toMatch(/expired/i);
		expect(describeAgentError({ status: 403 }).message).toMatch(/access/i);
		expect(describeAgentError({ status: 429 }).message).toMatch(/requests/i);
		expect(
			describeAgentError({ name: "AbortError", message: "AbortError" }).message,
		).toMatch(/stopped/i);
	});
});
