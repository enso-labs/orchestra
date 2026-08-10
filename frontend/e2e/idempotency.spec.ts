/**
 * Blocking Agent Protocol contract: duplicate submissions do not start a
 * second run while the first SDK stream is active.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";
import { chatInput, chatSubmitButton, waitForChatInput } from "./helpers/chat";

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
		await page.route("**/threads", async (route) => {
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
		await waitForChatInput(page);
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

		await chatInput(page).fill("first submission");
		const submit = chatSubmitButton(page);
		await expect(submit).toBeVisible();

		// Dispatch both events in one browser task. A normal second Playwright
		// click waits for React to commit the first state update, by which point
		// the submit control has intentionally become the abort control (and the
		// onboarding wrapper may be hidden). The two immediate events reach the
		// same submit button and exercise the queue's duplicate guard directly.
		await submit.evaluate((button) => {
			const dispatchClick = () =>
				button.dispatchEvent(
					new MouseEvent("click", { bubbles: true, cancelable: true }),
				);
			dispatchClick();
			dispatchClick();
		});

		await expect(
			page.locator("div.py-2.whitespace-pre-wrap.break-words").filter({
				hasText: "first submission",
			}),
		).toBeVisible({
			timeout: 30_000,
		});
		await expect.poll(() => streamRequests).toBe(1);
		expect(
			await page.getByText("duplicate submission", { exact: true }).count(),
		).toBe(0);
	});
});
