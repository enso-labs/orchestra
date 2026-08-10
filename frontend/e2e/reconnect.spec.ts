/**
 * Blocking Agent Protocol contract: an interrupted resumable stream reconnects
 * with the SDK cursor and renders the continuation exactly once.
 */

import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";
import { chatInput, chatSubmitButton, waitForChatInput } from "./helpers/chat";

let mockServer: Server;
let mockBaseUrl: string;
let reconnectLastEventId: string | undefined;
let streamAttempts = 0;

function corsHeaders() {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers":
			"Authorization, Content-Type, Last-Event-ID",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Expose-Headers": "Location, Content-Location",
	};
}

async function startMockStreamServer() {
	mockServer = createServer((request, response) => {
		if (request.method === "OPTIONS") {
			response.writeHead(204, corsHeaders());
			response.end();
			return;
		}
		if (!request.url?.includes("/runs/stream")) {
			response.writeHead(404, corsHeaders());
			response.end();
			return;
		}

		streamAttempts += 1;
		if (streamAttempts === 1) {
			response.writeHead(200, {
				...corsHeaders(),
				"Content-Type": "text/event-stream",
				Location: `${new URL(request.url, mockBaseUrl).pathname}?resume=1`,
			});
			response.write(
				'id: cursor-1\nevent: metadata\ndata: {"run_id":"run-reconnect","thread_id":"thread-reconnect"}\n\n',
			);
			// A reset after an identified event exercises the SDK's Last-Event-ID
			// reconnect path rather than a hand-written retry ladder.
			setTimeout(() => response.destroy(), 25);
			return;
		}

		reconnectLastEventId = request.headers["last-event-id"];
		response.writeHead(200, {
			...corsHeaders(),
			"Content-Type": "text/event-stream",
		});
		response.end(
			'id: cursor-2\nevent: messages\ndata: [{"id":"assistant-reconnect","type":"AIMessageChunk","content":"resumed"},{}]\n\n',
		);
	});
	mockServer.listen(0, "127.0.0.1");
	await once(mockServer, "listening");
	const address = mockServer.address();
	if (!address || typeof address === "string")
		throw new Error("Mock server did not bind");
	mockBaseUrl = `http://127.0.0.1:${address.port}`;
}

test.describe("Agent Protocol resumable stream contract", () => {
	test.beforeAll(async () => {
		await startMockStreamServer();
	});

	test.afterAll(async () => {
		mockServer.close();
		await once(mockServer, "close");
	});

	test.beforeEach(async ({ page }) => {
		streamAttempts = 0;
		reconnectLastEventId = undefined;
		await loginAsAdmin(page);
		await page.route("**/threads*", async (route) => {
			const request = route.request();
			const pathname = new URL(request.url()).pathname;
			if (request.method() === "POST" && pathname === "/threads") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						thread_id: "thread-reconnect",
						metadata: {},
						values: {},
					}),
				});
				return;
			}
			await route.continue();
		});
		await page.goto("/chat", { waitUntil: "domcontentloaded" });
		await waitForChatInput(page);
	});

	test("resumes with the cursor after the stream connection resets", async ({
		page,
	}) => {
		await page.route("**/threads/**/runs/stream**", async (route) => {
			const requestUrl = new URL(route.request().url());
			await route.continue({
				url: `${mockBaseUrl}${requestUrl.pathname}${requestUrl.search}`,
			});
		});

		await chatInput(page).fill("resume this response");
		await chatSubmitButton(page).click();

		await expect(page.getByText("resumed", { exact: true })).toBeVisible({
			timeout: 30_000,
		});
		expect(streamAttempts).toBe(2);
		expect(reconnectLastEventId).toBe("cursor-1");
	});
});
