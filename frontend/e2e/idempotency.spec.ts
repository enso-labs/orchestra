/**
 * Blocking Agent Protocol contract: duplicate submissions do not start a
 * second run while the first SDK stream is active.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

const CHAT_INPUT =
	'textarea[placeholder="How can I help you be more productive?"]';
const SUBMIT_BUTTON = '[data-tour="chat-submit-button"]';

function streamBody() {
	return [
		"event: metadata",
		'data: {"run_id":"run-browser-idempotency","thread_id":"thread-browser-idempotency"}',
		"",
		"event: messages",
		'data: [{"id":"assistant-browser-idempotency","type":"AIMessageChunk","content":"ack"},{}]',
		"",
		"event: values",
		'data: {"messages":[]}',
		"",
		"",
	].join("\n");
}

test.describe("Agent Protocol duplicate run contract", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
		await page.route("**/threads*", async (route) => {
			const request = route.request();
			const pathname = new URL(request.url()).pathname;
			if (request.method() === "POST" && pathname === "/threads") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						thread_id: "thread-browser-idempotency",
						metadata: {},
						values: {},
					}),
				});
				return;
			}
			await route.continue();
		});
		await page.goto("/chat", { waitUntil: "domcontentloaded" });
		await page
			.locator(CHAT_INPUT)
			.waitFor({ state: "visible", timeout: 30_000 });
	});

	test("rapid duplicate clicks create one SDK run", async ({ page }) => {
		let streamRequests = 0;
		await page.route("**/threads/**/runs/stream", async (route) => {
			streamRequests += 1;
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: streamBody(),
			});
		});

		await page.locator(CHAT_INPUT).fill("first submission");
		const submit = page.locator(SUBMIT_BUTTON);
		await submit.click({ force: true });
		await submit.click({ force: true });

		await expect(
			page.getByText("first submission", { exact: true }),
		).toBeVisible({
			timeout: 30_000,
		});
		await expect.poll(() => streamRequests).toBe(1);
		expect(
			await page.getByText("duplicate submission", { exact: true }).count(),
		).toBe(0);
	});
});
