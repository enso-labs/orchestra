import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { FetchStreamReader, ResponseBodyReader } from "./fetchStreamReader";
import type { StreamEvent } from "@/lib/entities/stream";

const sseResponse = (lines: string[]) =>
	new Response(new TextEncoder().encode(lines.join("\n")));

describe("ResponseBodyReader parseEvent", () => {
	it("parses mcp_sandbox_unreachable instead of dropping it", async () => {
		const events: StreamEvent[] = [];
		const reader = new ResponseBodyReader(
			sseResponse([
				'data: ["mcp_sandbox_unreachable", "MCP sandbox unreachable: refused"]',
				"",
				"data: [DONE]",
				"",
			]),
		);
		reader.onEvent((event) => events.push(event));
		reader.onError(vi.fn());

		await reader.start();

		expect(events).toEqual([
			{
				type: "mcp_sandbox_unreachable",
				data: "MCP sandbox unreachable: refused",
			},
			{ type: "done" },
		]);
	});

	it("still drops genuinely unknown event types", async () => {
		const events: StreamEvent[] = [];
		const reader = new ResponseBodyReader(
			sseResponse(['data: ["not_a_real_event", "x"]', ""]),
		);
		reader.onEvent((event) => events.push(event));

		await reader.start();

		expect(events).toEqual([]);
	});
});

describe("FetchStreamReader parseEvent", () => {
	it("parses mcp_sandbox_unreachable instead of dropping it", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				sseResponse([
					'data: ["mcp_sandbox_unreachable", "MCP sandbox unreachable: timeout"]',
					"",
				]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const events: StreamEvent[] = [];
		const reader = new FetchStreamReader("/stream");
		reader.onEvent((event) => events.push(event));
		reader.onError(vi.fn());

		await reader.start();

		expect(events).toEqual([
			{
				type: "mcp_sandbox_unreachable",
				data: "MCP sandbox unreachable: timeout",
			},
		]);

		vi.unstubAllGlobals();
	});
});
